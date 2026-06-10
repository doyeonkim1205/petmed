'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, ArrowLeft, ArrowRight, Sparkles, AlertCircle, Cat, Dog, Info, Image as ImageIcon, PawPrint, Loader2, Crown, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { compressImage } from '@/lib/imageCompress';
import { authFetch } from '@/lib/authFetch';
import { LoadingScreen } from '@/components/LoadingScreen';

// excretion = 대소변·구토 (사용자 사용 빈도 ↑). '기타' 제거 + '분비물 단일 카테고리' 추가.
type Category = 'skin' | 'eye' | 'wound' | 'dental' | 'ear' | 'excretion';

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

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'skin',      label: '피부' },
  { value: 'eye',       label: '눈' },
  { value: 'wound',     label: '외상' },
  { value: 'dental',    label: '입·치아' },
  { value: 'ear',       label: '귀' },
  { value: 'excretion', label: '대소변·구토' },
];

interface UsageInfo {
  used: number;
  limit: number;
  plan: 'free' | 'plus';
  window: 'lifetime' | 'daily';
}

// sessionStorage cache — 사용자가 다른 탭 갔다 와도 결과/입력 유지.
// 페이지 닫으면 자동 삭제 (sessionStorage 특성). userId 별로 키 분리.
// v2: 카테고리 'other' → 'excretion' 변경으로 옛 캐시 무효화.
const cacheKey = (userId: string) => `photo-analysis-cache-v2:${userId}`;
interface PhotoCache {
  imageDataUrl?: string | null;
  hint?: string;
  category?: Category;
  selectedPetId?: string | null;
  result?: AnalysisResult | null;
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

  const [usage, setUsage] = useState<UsageInfo | null>(null);
  // 사진 업로드 input 2개로 분리 — 카메라/갤러리 액션 시트 대신 명시적 두 진입점.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // 결과 화면 뒤로가기 처리용 동기 lock — 시스템 백 vs 명시 reset 충돌 방지.
  const isResettingRef = useRef(false);
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
        // selectedPetId 는 펫 fetch 후 검증해서 적용
      }
      // 2) 서버 fetch
      const [petsRes, usageRes] = await Promise.all([
        supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!alive) return;
      const petList = sortPetsWithDefault(petsRes.data ?? [], readDefaultPetId());
      setPets(petList);
      // 캐시 selectedPetId 유효성 검증 후 적용, 무효면 첫 펫(=기본 펫).
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
    // dep 에 user 객체 X — visibility/token refresh 시 reference 바뀌어 재실행되면
    // fetch 진행 중 잠시 빈 배열 → "펫 미등록" 안내 깜빡임. user.id (primitive) 로 비교.
  }, [user?.id]);

  // state → sessionStorage 저장 (복원 끝난 후만).
  useEffect(() => {
    if (!user || !cacheRestoredRef.current) return;
    saveCache(user.id, { imageDataUrl, hint, category, selectedPetId, result });
  }, [user, imageDataUrl, hint, category, selectedPetId, result]);

  if (authLoading) return <LoadingScreen inMain />;
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
    try {
      const res = await authFetch('/api/symptom-analysis-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          hint: hint.trim() || undefined,
          category,
          petType: selectedPet.type,
          // 맞춤 분석은 Plus 전용 — 무료(체험)는 petId 미전송(종만 반영, 의료정보 X). 서버에도 동일 게이트.
          ...(usage?.plan === 'plus' ? { petId: selectedPet.id } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || '분석 중 오류가 발생했어요.');
        return;
      }
      setResult(data as AnalysisResult);
      // 응답에 usage 포함 — 즉시 setUsage (별도 fetch 없이 stale 방지).
      if (data.usage) {
        setUsage({
          used: data.usage.used,
          limit: data.usage.limit,
          plan: data.usage.plan,
          window: data.usage.window || (data.usage.plan === 'free' ? 'lifetime' : 'daily'),
        });
      }
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    } catch {
      setServerError('네트워크 오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  // 결과 화면을 닫고 입력 화면으로 복귀.
  // - 명시 호출 (헤더/하단 버튼): dummy history state 명시 정리 (history.back)
  // - popstate 호출 (시스템 백 버튼): 이미 dummy 가 stack 에서 빠진 상태 → 추가 정리 X
  const handleReset = (opts?: { fromPopstate?: boolean }) => {
    isResettingRef.current = true;
    if (!opts?.fromPopstate &&
        typeof window !== 'undefined' &&
        window.history.state?.photoResult) {
      // dummy state 정리 — popstate 가 또 발생하지만 isResettingRef 로 무시됨.
      window.history.back();
    }
    setImageDataUrl(null);
    setHint('');
    setResult(null);
    setServerError(null);
    if (user) clearCache(user.id);
    cacheRestoredRef.current = true;
    // popstate 이벤트가 microtask 큐에 들어가 있을 수 있으므로 짧은 지연 후 lock 해제.
    setTimeout(() => { isResettingRef.current = false; }, 50);
    // 입력 화면 복귀 시 usage refetch — 다른 디바이스/탭에서 분석한 경우의 stale 도 방어.
    authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).then(u => {
      if (u) setUsage({
        used: u.photo.used,
        limit: u.photo.limit,
        plan: u.plan,
        window: u.photo.window || (u.plan === 'free' ? 'lifetime' : 'daily'),
      });
    }).catch(() => {});
  };

  // result 표시 시 dummy history state push → 시스템 백 버튼이 페이지 떠나는 대신
  // result 만 닫도록 (handleReset 호출). 사용자 의도 ("결과 → 입력 화면") 와 일치.
  useEffect(() => {
    if (!result || typeof window === 'undefined') return;
    // 이미 photoResult state 면 중복 push 방지 (effect 재실행 케이스 방어)
    if (window.history.state?.photoResult) return;
    window.history.pushState({ photoResult: true }, '');

    const onPopState = () => {
      // 명시 reset 중이면 (handleReset 의 history.back 호출이 만든 popstate) 무시
      if (isResettingRef.current) return;
      handleReset({ fromPopstate: true });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // handleReset 은 stable (state setter only) 이라 deps 에 안 넣어도 안전
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // 입력 영역 노출 조건 — result 가 없을 때만 (옵션 B: 결과 전용 화면 전환)
  const showInputArea = !result;

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 bg-white z-10">
        {/* 뒤로가기 — 결과 화면일 땐 입력 화면으로 복귀 (handleReset),
            그 외엔 표준 뒤로가기 (이전 페이지). 시스템 백 버튼과 동일 흐름. */}
        <button
          type="button"
          onClick={() => {
            if (result) handleReset();
            else router.back();
          }}
          className="absolute left-2 p-2 text-gray-500"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">사진 분석</h1>
      </header>

      <main className="max-w-md mx-auto px-4 pt-1 space-y-4">
        {showInputArea && (
          <>
            {/* Free 한도 소진 안내 — 텍스트 분석/논문 한도 박스와 동일한 톤
                (gradient + Crown + 요금제 보기 버튼) */}
            {isFreeNoQuota && (
              <div className="text-center py-2">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock size={24} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 font-medium break-keep break-words">사진 분석 무료 체험을 모두 사용했어요.</p>
                <p className="text-[11px] text-gray-400 mt-1 break-keep break-words">Plus로 업그레이드하면 계속 사용할 수 있어요.</p>
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Crown size={16} className="text-purple-500" />
                    <p className="text-sm font-bold text-gray-700">우리 아이 건강, 빈틈없이 케어하기</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">AI 맞춤 분석 · 더 많은 검색 · 푸시 알림 · 논문 보관</p>
                  <button
                    type="button"
                    onClick={() => router.push('/profile/subscription')}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium"
                  >
                    요금제 보기
                  </button>
                </div>
              </div>
            )}

            {/* 펫 fetch 중 스피너 — 펫 미등록 안내가 잠깐 깜빡이지 않도록 */}
            {petsLoading && (
              <div className="bg-white rounded-lg p-6 flex justify-center border border-gray-200">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            )}

            {/* 펫 미등록 안내 */}
            {!petsLoading && !hasPets && (
              <section className="bg-white rounded-lg p-5 text-center border border-gray-200">
                <PawPrint size={32} className="mx-auto mb-2 text-blue-300" />
                <h2 className="text-sm font-bold text-gray-800 mb-1">먼저 반려동물을 등록해 주세요</h2>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  아이의 특성에 맞춘 정밀한 체크를 위해 정보 등록이 필요합니다<br />
                  마이페이지에서 등록 후 다시 시도해주세요
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="px-4 py-2 rounded-full bg-white border border-blue-300 text-blue-600 text-xs font-semibold hover:bg-blue-50"
                >
                  반려동물 등록하러 가기
                </button>
              </section>
            )}

            {/* 펫 선택 */}
            {!petsLoading && hasPets && (
              <section className="bg-white rounded-lg p-4 border border-gray-200">
                <h2 className="text-xs font-semibold text-gray-500 mb-2">분석할 반려동물</h2>
                <div className="flex gap-1.5 overflow-x-auto">
                  {pets.map(pet => {
                    const active = selectedPetId === pet.id;
                    const Icon = pet.type === 'dog' ? Dog : Cat;
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => setSelectedPetId(pet.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                          active ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'
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

            {/* 증상 부위 (카테고리) — 6개라 3열 grid 로 정렬. 필수. */}
            <section className="bg-white rounded-lg p-4 border border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 mb-2">
                증상 부위 <span className="text-[10px] text-gray-700 font-normal">(필수)</span>
              </h2>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`py-2 rounded-full text-xs font-medium ${
                      category === c.value ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">💡 밝은 곳에서 가까이 찍을수록 분석 결과가 정확해져요</p>
            </section>

            {/* 증상 사진 첨부 — 헤더 우측에 사용량 칩 (Plus/Free 통일 톤) */}
            <section className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-500">
                  증상 사진 첨부 <span className="text-[10px] text-gray-700 font-normal">(필수)</span>
                </h2>
                {usage && (
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
                )}
              </div>
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
                /* 두 진입점 — 직접 촬영 / 갤러리 불러오기. 중앙에 점 구분자.
                   모바일에선 capture 속성으로 카메라/갤러리 명시 분리. */
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg py-7 flex items-center justify-center gap-4 text-gray-500 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 px-3 hover:text-blue-600"
                  >
                    <Camera size={26} />
                    <span className="text-xs font-medium">직접 촬영하기</span>
                  </button>
                  <span className="text-gray-300 text-xl leading-none">·</span>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 px-3 hover:text-blue-600"
                  >
                    <ImageIcon size={26} />
                    <span className="text-xs font-medium">갤러리에서 불러오기</span>
                  </button>
                </div>
              )}
              {/* 카메라 강제 — capture="environment" 로 후면 카메라 실행 */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              {/* 갤러리만 — capture 없음. iOS/Android 모두 사진 보관함 노출 */}
              <input
                ref={galleryInputRef}
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

            {/* 증상 상세 내용 (필수) — 정확도가 텍스트 정보에 크게 좌우됨 */}
            <section className="bg-white rounded-lg p-4 border border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 mb-2">
                증상 상세 내용 <span className="text-[10px] text-gray-700 font-normal">(필수)</span>
              </h2>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value.slice(0, 500))}
                placeholder="예: 3일 전부터 가려워해요. 오른쪽 귀 안쪽이에요."
                rows={3}
                className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-blue-400"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-gray-400">언제부터·어디가·어떤지 알려주세요 (최소 5자)</p>
                <p className="text-[11px] text-gray-400">{hint.length}/500</p>
              </div>
            </section>

            {/* 책임 제한 — 분석 버튼 바로 위. 상세 정보는 결과 화면 사진 옆 ⓘ. */}
            <div className="text-[11px] text-gray-500 leading-relaxed px-1">
              AI 분석 결과는 참고용입니다! 정확한 진단은 동물병원을 방문해 주세요
            </div>

            {/* isQuotaExhausted 도 가드 — Plus 한도 (3회/일) 소진 시도 차단.
                isFreeNoQuota 는 Free + limit=0 (Plus 전용) 케이스 커버. */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={
                !imageDataUrl ||
                !selectedPet ||
                hint.trim().length < 5 ||
                analyzing ||
                isFreeNoQuota === true ||
                isQuotaExhausted === true
              }
              className="w-full py-3 rounded-full bg-blue-600 text-white font-semibold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
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
}: {
  result: AnalysisResult;
  imageDataUrl: string | null;
  onReset: () => void;
}) {
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);
  // 텍스트 증상 분석 페이지와 톤 통일 — low=초록(😊), medium=파랑(ℹ️), high=빨강(🚨).
  // AI reassurance 대신 short label 로 concern_level 시그널 표현.
  // high 일 땐 AI 가 watch_signs 를 안 생성 (emergency_signs 가 그 역할) — 헤더만 표시됨.
  const concernConfig = {
    low:    { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: '😊', textColor: 'text-emerald-800', label: '지금은 괜찮아 보여요' },
    medium: { border: 'border-blue-200',    bg: 'bg-blue-50',    icon: '🔍', textColor: 'text-blue-800',    label: '지켜봐 주세요' },
    high:   { border: 'border-red-200',     bg: 'bg-red-50',     icon: '🚨', textColor: 'text-red-800',     label: '빠른 진료가 필요해요' },
  } as const;
  const concernKey =
    result.concern_level === 'low' ? 'low' :
    result.concern_level === 'high' ? 'high' :
    'medium';
  const cfg = concernConfig[concernKey];
  const hasWatchSigns = !!result.watch_signs && result.watch_signs.length > 0;
  const hasEmergencySigns = !!result.emergency_signs && result.emergency_signs.length > 0;

  return (
    <section id="photo-result" className="space-y-3 pt-2">
      {/* 분석한 사진 + i 아이콘 (개인정보 안내) */}
      {imageDataUrl && (
        <div className="bg-white rounded-lg p-3 border border-gray-200">
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
                    사진은 분석에만 쓰이고 <strong>서버에 저장되지 않아요</strong>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 부적합 — AI 가 is_valid_photo=false 로 판정한 경우만 노출.
          액션 버튼은 박스 안에 두지 않음 — 결과 화면 하단의 통일 버튼 사용.
          박스는 안내 (다시 찍어주세요 + 이유) 만 담당해서 시각 잡음 ↓ */}
      {result.is_valid_photo === false && (
        <div className="bg-white rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-semibold text-amber-900 mb-1">사진을 다시 찍어주세요</p>
          <p className="text-xs text-gray-700 leading-relaxed">{result.invalid_reason || '사진이 분석에 적합하지 않아요'}</p>
        </div>
      )}

      {/* 관찰 사항 — 본문 폰트를 다른 섹션과 동일하게 text-xs 로 통일 */}
      {result.observations && result.observations.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">사진에서 관찰된 내용</h3>
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
            {result.observations.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}

      {/* 안내 카드 — low/medium/high 모두 노출. emergency_signs 도 카드 안 통합.
          - high:       헤더 + emergency_signs (주된 케이스)
          - low/medium: 헤더 + watch_signs
          - 둘 다 있으면: emergency 위 / watch 아래 (긴급도 순) */}
      {result.is_valid_photo !== false && (result.concern_level === 'low' || result.concern_level === 'medium' || result.concern_level === 'high') && (
        <div className={`rounded-lg p-4 border ${cfg.border} ${cfg.bg}`}>
          <p className={`text-sm font-semibold ${cfg.textColor} ${(hasEmergencySigns || hasWatchSigns) ? 'mb-3' : ''}`}>
            <span className="mr-1">{cfg.icon}</span>{cfg.label}
          </p>
          {hasEmergencySigns && (
            <div className={hasWatchSigns ? 'mb-3' : ''}>
              {/* "병원에 가야 할 신호" 헤더 제거 — concern_level 라벨 ("빠른 진료가 필요해요") 와 의미 중복.
                  [즉시] / [24시간내] 뱃지가 충분한 context 제공. */}
              <ul className="text-xs text-gray-700 space-y-1">
                {result.emergency_signs!.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    {/* 즉시 / 24시간내 색상 — 텍스트 증상 분석과 통일 (즉시=red, 24시간내=orange) */}
                    <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                      s.severity === '즉시' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {s.severity}
                    </span>
                    <span>{s.sign}{s.reason ? ` — ${s.reason}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasWatchSigns && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">🩺 이런 경우엔 진료를 고려하세요</p>
              <ul className="text-xs text-gray-700 space-y-0.5 list-disc pl-4">
                {result.watch_signs!.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 의심 질병 배너 — 텍스트 증상 분석과 톤 통일 위해 헤더 라인 제거 */}
      {result.diseases && result.diseases.length > 0 && (
        <div className="space-y-2">
          {result.diseases.map((d, i) => (
            <div key={i} className={`rounded-lg p-4 border ${
              d.severity === '긴급' ? 'bg-red-50 border-red-200' :
              d.severity === '주의' ? 'bg-orange-50 border-orange-200' :
              'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-baseline gap-2 mb-2">
                <h4 className="font-bold text-sm">{d.name_ko}</h4>
                {d.name_en && <span className="text-[11px] text-gray-400">({d.name_en})</span>}
              </div>
              {/* 뱃지 순서 — 텍스트 분석과 통일: severity (긴급/주의/관찰) 먼저, 가능성 다음.
                  likelihood 색상도 텍스트 분석과 동일 (높음=red, 중간=yellow, 낮음=gray). */}
              <div className="flex gap-1.5 mb-2 text-[11px]">
                {/* severity 색상 — 텍스트 증상 분석과 100% 동일.
                    긴급=red, 주의=orange, 관찰=green. */}
                <span className={`px-2 py-0.5 rounded-full font-bold ${
                  d.severity === '긴급' ? 'bg-red-100 text-red-700' :
                  d.severity === '주의' ? 'bg-orange-100 text-orange-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {d.severity || '관찰'}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${
                  d.likelihood === '높음' ? 'bg-red-100 text-red-600' :
                  d.likelihood === '중간' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  가능성 {d.likelihood || '낮음'}
                </span>
              </div>
              {d.description && (
                <p className="text-xs text-gray-700 leading-relaxed mb-2">{d.description}</p>
              )}
              {d.action && (
                <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2.5">
                  <ArrowRight size={14} className={`mt-0.5 flex-shrink-0 ${
                    d.severity === '긴급' ? 'text-red-600' :
                    d.severity === '관찰' ? 'text-green-600' :
                    'text-orange-600'
                  }`} />
                  <p className="text-xs text-gray-700 font-medium">{d.action}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* emergency_signs 별도 카드 제거 — 안내 카드 (concern_level) 안에 통합됨 */}

      {/* 책임 제한 박스 — 마침표 제거 (일관 정책) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-800">⚠️ 분석 결과는 참고용이에요</strong><br />
          AI 분석은 사진 한 장의 시각 정보만으로 추정한 가능성이며 확진이 아니에요
          증상이 지속되거나 악화되면 반드시 동물병원에서 진료를 받아주세요
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full py-2.5 rounded-full bg-white border border-gray-300 text-gray-700 text-sm font-medium"
      >
        다른 사진으로 분석하기
      </button>
    </section>
  );
}
