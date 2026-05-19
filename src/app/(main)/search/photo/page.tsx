'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, ArrowLeft, Sparkles, AlertCircle, Cat, Dog, Info, Image as ImageIcon, PawPrint, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Pet } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { authFetch } from '@/lib/authFetch';
import { LoadingScreen } from '@/components/LoadingScreen';
import { saveThumbnail } from '@/lib/photoThumbnailStore';

type Category = 'skin' | 'eye' | 'wound' | 'dental' | 'ear' | 'other';

interface AnalysisResult {
  is_valid_photo: boolean;
  invalid_reason?: string;
  main_category?: string;
  ai_confidence?: 'low' | 'medium' | 'high';
  observations?: string[];
  diseases?: Array<{
    name_ko: string;
    name_en?: string;
    category?: string;
    likelihood?: '높음' | '중간' | '낮음';
    severity?: '긴급' | '주의' | '관찰';
    description?: string;
    matching_symptoms?: string[];
    additional_symptoms?: string[];
    action?: string;
  }>;
  emergency_signs?: Array<{
    sign: string;
    severity?: '즉시' | '24시간내';
    reason?: string;
  }>;
  concern_level?: 'low' | 'medium' | 'high';
  reassurance?: string;
  watch_signs?: string[];
}

const CATEGORIES: Array<{ value: Category; label: string; hint: string }> = [
  { value: 'skin',   label: '피부',     hint: '병변 부위를 가까이서, 자연광에서 찍어주세요' },
  { value: 'eye',    label: '눈',       hint: '눈을 정면으로, 너무 어둡지 않게 찍어주세요' },
  { value: 'wound',  label: '외상',     hint: '상처 크기·깊이를 비교할 수 있게 가까이 찍어주세요' },
  { value: 'dental', label: '입·치아',  hint: '입을 살짝 벌려 잇몸·치아가 잘 보이게 찍어주세요' },
  { value: 'ear',    label: '귀',       hint: '귀 안쪽이 보이도록 귀를 살짝 들고 찍어주세요' },
  { value: 'other',  label: '기타',     hint: '진단 부위가 화면에 충분히 크게 나오게 찍어주세요' },
];

interface UsageInfo {
  used: number;
  limit: number;
  plan: 'free' | 'plus';
  window: 'lifetime' | 'daily';
}

// sessionStorage cache — 사용자가 다른 탭 갔다 와도 결과/입력 유지.
// 페이지 닫으면 자동 삭제 (sessionStorage 특성). userId 별로 키 분리.
const cacheKey = (userId: string) => `photo-analysis-cache-v1:${userId}`;
interface PhotoCache {
  imageDataUrl?: string | null;
  hint?: string;
  category?: Category;
  selectedPetId?: string | null;
  result?: AnalysisResult | null;
  savedId?: string | null;
}
function loadCache(userId: string): PhotoCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) as PhotoCache : null;
  } catch { return null; }
}
function saveCache(userId: string, c: PhotoCache) {
  try { sessionStorage.setItem(cacheKey(userId), JSON.stringify(c)); } catch {}
}
function clearCache(userId: string) {
  try { sessionStorage.removeItem(cacheKey(userId)); } catch {}
}

export default function PhotoAnalysisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [pets, setPets] = useState<Pet[]>([]);
  // 펫 fetch 완료 전엔 등록 여부 판정 불가 — petsLoading 으로 미등록 안내 깜빡임 차단.
  const [petsLoading, setPetsLoading] = useState(true);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('skin');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // sessionStorage 복원 완료 후에만 캐시 저장 effect 가 작동하도록 가드.
  // 마운트 시 빈 state 를 캐시로 덮어쓰는 race 방지.
  const cacheRestoredRef = useRef(false);

  const selectedPet = selectedPetId ? pets.find(p => p.id === selectedPetId) ?? null : null;
  const hasPets = pets.length > 0;
  // Free 한도 소진 = 1회 체험 다 쓴 상태. 분석 버튼 비활성 + 안내 카드 노출.
  const isQuotaExhausted = !!usage && usage.limit > 0 && usage.used >= usage.limit;
  const isFreeNoQuota = !!usage && usage.plan === 'free' && (usage.limit === 0 || isQuotaExhausted);

  // 마운트: 펫 + 사용량 fetch + sessionStorage 복원.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      // 1) sessionStorage 복원 (서버 fetch 와 병렬)
      const cached = loadCache(user.id);
      if (cached) {
        if (cached.imageDataUrl !== undefined) setImageDataUrl(cached.imageDataUrl);
        if (cached.hint !== undefined) setHint(cached.hint);
        if (cached.category !== undefined) setCategory(cached.category);
        if (cached.result !== undefined) setResult(cached.result);
        if (cached.savedId !== undefined) setSavedId(cached.savedId);
        // selectedPetId 는 펫 fetch 후 검증해서 적용
      }
      // 2) 서버 fetch
      const [petsRes, usageRes] = await Promise.all([
        supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!alive) return;
      const petList = petsRes.data ?? [];
      setPets(petList);
      // 캐시 selectedPetId 유효성 검증 후 적용, 무효면 첫 펫.
      if (petList.length > 0) {
        const cachedPetId = cached?.selectedPetId;
        const validCached = cachedPetId && petList.some(p => p.id === cachedPetId) ? cachedPetId : null;
        setSelectedPetId(validCached ?? petList[0].id);
      }
      setPetsLoading(false);
      if (usageRes) setUsage({
        used: usageRes.photo.used,
        limit: usageRes.photo.limit,
        plan: usageRes.plan,
        window: usageRes.photo.window || (usageRes.plan === 'free' ? 'lifetime' : 'daily'),
      });
      // 첫 복원 끝 — 이후 state 변경 시 캐시 저장 효과 활성화.
      cacheRestoredRef.current = true;
    })();
    return () => { alive = false; };
  }, [user]);

  // state → sessionStorage 저장 (복원 끝난 후만).
  useEffect(() => {
    if (!user || !cacheRestoredRef.current) return;
    saveCache(user.id, { imageDataUrl, hint, category, selectedPetId, result, savedId });
  }, [user, imageDataUrl, hint, category, selectedPetId, result, savedId]);

  if (authLoading) return <LoadingScreen />;
  if (!user) {
    router.replace('/login');
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    try {
      const { dataUrl } = await compressImage(file);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '이미지를 읽지 못했어요.');
    }
  };

  const handleAnalyze = async () => {
    if (!imageDataUrl || analyzing || !selectedPet) return;
    setAnalyzing(true);
    setServerError(null);
    setResult(null);
    setSavedId(null);
    setSaveError(null);
    try {
      const res = await authFetch('/api/symptom-analysis-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          hint: hint.trim() || undefined,
          category,
          petType: selectedPet.type,
          petId: selectedPet.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || '분석 중 오류가 발생했어요.');
        return;
      }
      setResult(data as AnalysisResult);
      authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).then(u => {
        if (u) setUsage({
          used: u.photo.used,
          limit: u.photo.limit,
          plan: u.plan,
          window: u.photo.window || (u.plan === 'free' ? 'lifetime' : 'daily'),
        });
      });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    } catch {
      setServerError('네트워크 오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImageDataUrl(null);
    setHint('');
    setResult(null);
    setServerError(null);
    setSavedId(null);
    setSaveError(null);
    if (user) clearCache(user.id);
    cacheRestoredRef.current = true; // 다음 변경부터 다시 저장 시작
  };

  const handleSave = async () => {
    if (!result || !imageDataUrl || saving || savedId || !selectedPet) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch('/api/saved-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'symptom_photo',
          query: hint.trim() || `[사진 분석: ${CATEGORIES.find(c => c.value === category)?.label || '기타'}]`,
          petType: selectedPet.type,
          analysis: result,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        setSaveError(data?.error || '저장에 실패했어요.');
        return;
      }
      setSavedId(data.id);
      saveThumbnail(data.id, imageDataUrl);
    } catch {
      setSaveError('네트워크 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  const catHint = CATEGORIES.find(c => c.value === category)?.hint || '';
  // 입력 영역 노출 조건 — result 가 없을 때만 (옵션 B: 결과 전용 화면 전환)
  const showInputArea = !result;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-2 p-2 rounded-full hover:bg-gray-100"
            aria-label="뒤로 가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold">사진 분석</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* 사용량 칩 — /search 와 동일한 톤. Free=gray, Plus=blue. */}
        {usage && (
          <div className="flex justify-center -mb-2">
            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
              usage.plan === 'plus' ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
            }`}>
              {usage.plan === 'plus' ? (
                <><Sparkles size={10} /> Plus {usage.used}/{usage.limit}</>
              ) : usage.limit > 0 ? (
                <>Free 체험 {usage.used}/{usage.limit}</>
              ) : (
                <>Plus 전용</>
              )}
            </span>
          </div>
        )}

        {showInputArea && (
          <>
            {/* Free 한도 소진 안내 — 1회 체험 다 쓴 후 */}
            {isFreeNoQuota && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-semibold mb-1">사진 분석 무료 체험을 모두 사용했어요</p>
                    <p className="text-xs leading-relaxed mb-3">
                      Plus 로 업그레이드하면 매일 3회 사진을 분석할 수 있어요.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/profile/subscription')}
                      className="text-xs font-semibold bg-purple-600 text-white px-3 py-1.5 rounded-full"
                    >
                      Plus 둘러보기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 펫 fetch 중 스피너 — 펫 미등록 안내가 잠깐 깜빡이지 않도록 */}
            {petsLoading && (
              <div className="bg-white rounded-lg p-6 shadow-sm flex justify-center">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            )}

            {/* 펫 미등록 안내 */}
            {!petsLoading && !hasPets && (
              <section className="bg-white rounded-lg p-5 shadow-sm text-center">
                <PawPrint size={32} className="mx-auto mb-2 text-purple-300" />
                <h2 className="text-sm font-bold text-gray-800 mb-1">먼저 반려동물을 등록해 주세요</h2>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  사진 분석은 반려동물의 나이·품종·만성질환 정보를 함께 활용해야 정확해요.
                  마이페이지에서 등록하고 다시 시도해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="px-4 py-2 rounded-full bg-purple-600 text-white text-xs font-semibold"
                >
                  반려동물 등록하러 가기
                </button>
              </section>
            )}

            {/* 펫 선택 */}
            {!petsLoading && hasPets && (
              <section className="bg-white rounded-lg p-4 shadow-sm">
                <h2 className="text-xs font-semibold text-gray-500 mb-2">분석할 반려동물</h2>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                  {pets.map(pet => {
                    const active = selectedPetId === pet.id;
                    const Icon = pet.type === 'dog' ? Dog : Cat;
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => setSelectedPetId(pet.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                          active ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        <Icon size={12} />
                        {pet.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 증상 부위 (카테고리) — 6개라 2열 grid 로 정렬 */}
            <section className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-gray-500 mb-2">증상 부위</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`py-2 rounded-full text-xs font-medium ${
                      category === c.value ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">💡 {catHint}</p>
            </section>

            {/* 증상 사진 첨부 */}
            <section className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-gray-500 mb-2">증상 사진 첨부</h2>
              {imageDataUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="업로드한 사진"
                    className="w-full rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setImageDataUrl(null)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                    aria-label="사진 제거"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center justify-center gap-2 text-gray-500 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Camera size={24} />
                    <span className="text-gray-300">·</span>
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-sm font-medium mt-1">촬영하거나 갤러리에서 선택</span>
                  <span className="text-[11px] text-gray-400">JPG · PNG · 1장</span>
                </button>
              )}
              {/* capture 속성을 빼서 모바일에서 카메라/갤러리 둘 다 액션 시트로 선택 가능. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {imageError && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {imageError}
                </p>
              )}
            </section>

            {/* 증상 상세 내용 (선택) */}
            <section className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-gray-500 mb-2">
                증상 상세 내용 <span className="text-gray-400 font-normal">(선택)</span>
              </h2>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value.slice(0, 200))}
                placeholder="예: 3일 전부터 가려워해요. 오른쪽 귀 안쪽이에요."
                rows={3}
                className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-purple-400"
              />
              <p className="text-[11px] text-gray-400 text-right mt-1">{hint.length}/200</p>
            </section>

            {/* 책임 제한 1줄 — 상세 정보는 결과 화면의 사진 옆 ⓘ 에서 안내 */}
            <div className="text-[11px] text-gray-500 leading-relaxed px-1">
              ⚠️ AI 분석은 참고용이에요. 정확한 진단은 동물병원에서 받으셔야 해요.
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!imageDataUrl || !selectedPet || analyzing || isFreeNoQuota === true}
              className="w-full py-3 rounded-full bg-purple-600 text-white font-semibold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {analyzing ? 'AI가 분석 중이에요...' : '사진 분석하기'}
            </button>

            {serverError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-line">
                {serverError}
              </div>
            )}
          </>
        )}

        {/* 결과 전용 화면 — result 있으면 입력 영역 숨김 */}
        {result && (
          <ResultPanel
            result={result}
            imageDataUrl={imageDataUrl}
            onReset={handleReset}
            onSave={handleSave}
            saving={saving}
            savedId={savedId}
            saveError={saveError}
          />
        )}
      </main>
    </div>
  );
}

/* ─── 결과 패널 ────────────────────────────────────────────────── */
function ResultPanel({
  result,
  imageDataUrl,
  onReset,
  onSave,
  saving,
  savedId,
  saveError,
}: {
  result: AnalysisResult;
  imageDataUrl: string | null;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  savedId: string | null;
  saveError: string | null;
}) {
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);
  const concernColor =
    result.concern_level === 'high' ? 'border-red-200 bg-red-50' :
    result.concern_level === 'medium' ? 'border-amber-200 bg-amber-50' :
    'border-emerald-200 bg-emerald-50';

  return (
    <section id="photo-result" className="space-y-3 pt-2">
      {/* 분석한 사진 + i 아이콘 (개인정보 안내) */}
      {imageDataUrl && (
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageDataUrl} alt="분석한 사진" className="w-16 h-16 rounded-md object-cover border border-gray-200" />
            <div className="flex-1 flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-700">분석에 사용한 사진</p>
              <button
                type="button"
                onClick={() => setShowPrivacyTooltip(v => !v)}
                onBlur={() => setShowPrivacyTooltip(false)}
                className="relative text-gray-400 hover:text-gray-600"
                aria-label="개인정보 보호 안내"
              >
                <Info size={14} />
                {showPrivacyTooltip && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 bg-gray-900 text-white text-[11px] rounded-md p-2 leading-relaxed shadow-lg z-10 text-left">
                    사진은 서버에 저장되지 않아요. 분석 결과를 저장하면 <strong>이 기기 보관함</strong>에서만 사진이 보이고, 다른 기기에선 보이지 않아요.
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 부적합 */}
      {result.is_valid_photo === false && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-amber-200">
          <p className="text-sm font-semibold text-amber-900 mb-1">사진을 다시 찍어주세요</p>
          <p className="text-xs text-gray-700 leading-relaxed">{result.invalid_reason || '사진이 분석에 적합하지 않아요.'}</p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 w-full py-2 rounded-full bg-amber-500 text-white text-xs font-semibold"
          >
            다시 찍기
          </button>
        </div>
      )}

      {/* 관찰 사항 */}
      {result.observations && result.observations.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">사진에서 관찰된 내용</h3>
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
            {result.observations.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}

      {/* 안내 카드 (low/medium) */}
      {result.is_valid_photo !== false && (result.concern_level === 'low' || result.concern_level === 'medium') && (
        <div className={`rounded-lg p-4 border ${concernColor}`}>
          {result.reassurance && (
            <p className="text-sm text-gray-800 leading-relaxed mb-3">{result.reassurance}</p>
          )}
          {result.watch_signs && result.watch_signs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">이런 경우엔 진료를 고려하세요</p>
              <ul className="text-xs text-gray-700 space-y-0.5 list-disc pl-4">
                {result.watch_signs.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 의심 진단 */}
      {result.diseases && result.diseases.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 px-1">의심 진단</h3>
          {result.diseases.map((d, i) => (
            <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="font-bold text-sm">{d.name_ko}</h4>
                {d.name_en && <span className="text-[11px] text-gray-400">{d.name_en}</span>}
              </div>
              {d.category && <p className="text-[11px] text-gray-500 mb-2">{d.category}</p>}
              <div className="flex gap-1.5 mb-2 text-[11px]">
                {d.likelihood && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    가능성 {d.likelihood}
                  </span>
                )}
                {d.severity && (
                  <span className={`px-2 py-0.5 rounded-full ${
                    d.severity === '긴급' ? 'bg-red-100 text-red-700' :
                    d.severity === '주의' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {d.severity}
                  </span>
                )}
              </div>
              {d.description && (
                <p className="text-xs text-gray-700 leading-relaxed mb-2">{d.description}</p>
              )}
              {d.action && (
                <div className="text-xs bg-purple-50 text-purple-900 rounded p-2 leading-relaxed">
                  💡 {d.action}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 응급 신호 */}
      {result.emergency_signs && result.emergency_signs.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-red-100">
          <h3 className="text-xs font-semibold text-red-700 mb-2">병원에 가야 할 신호</h3>
          <ul className="text-xs text-gray-700 space-y-1">
            {result.emergency_signs.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                  s.severity === '즉시' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {s.severity}
                </span>
                <span>{s.sign}{s.reason ? ` — ${s.reason}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 책임 제한 박스 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-800">⚠️ 분석 결과는 참고용이에요.</strong><br />
          AI 분석은 사진 한 장의 시각 정보만으로 추정한 가능성이며, 확진이 아니에요.
          증상이 지속되거나 악화되면 반드시 동물병원에서 진료를 받아주세요.
        </p>
      </div>

      {/* 저장 + 다시 분석 */}
      {result.is_valid_photo !== false && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !!savedId}
            className={`w-full py-2.5 rounded-full text-sm font-semibold ${
              savedId
                ? 'bg-emerald-50 text-emerald-700 cursor-default'
                : 'bg-purple-600 text-white disabled:bg-gray-300'
            }`}
          >
            {savedId ? '✓ 보관함에 저장됨' : saving ? '저장 중...' : '분석 결과 저장'}
          </button>
          {saveError && (
            <p className="text-xs text-red-600 text-center">{saveError}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="w-full py-2.5 rounded-full bg-white border border-gray-300 text-gray-700 text-sm font-medium"
      >
        다른 사진 분석하기
      </button>
    </section>
  );
}
