'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, ArrowLeft, Sparkles, AlertCircle, Cat, Dog, Info, Image as ImageIcon, PawPrint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Pet } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { authFetch } from '@/lib/authFetch';
import { LoadingScreen } from '@/components/LoadingScreen';
import { saveThumbnail } from '@/lib/photoThumbnailStore';

type Category = 'skin' | 'eye' | 'other';

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
  { value: 'skin', label: '피부', hint: '병변 부위를 가까이서, 자연광에서 찍어주세요' },
  { value: 'eye', label: '눈', hint: '눈을 정면으로, 너무 어둡지 않게 찍어주세요' },
  { value: 'other', label: '기타', hint: '진단 부위가 화면에 충분히 크게 나오게 찍어주세요' },
];

export default function PhotoAnalysisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [pets, setPets] = useState<Pet[]>([]);
  // 등록 펫만 분석 대상 — 펫 미등록 시 안내 카드 표시.
  // 펫 1마리 이상이면 첫 펫 자동 선택, 사용자가 칩으로 변경 가능.
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

  const [usage, setUsage] = useState<{ used: number; limit: number; plan: 'free' | 'plus' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPet = selectedPetId ? pets.find(p => p.id === selectedPetId) ?? null : null;
  const isFreeNoQuota = usage && usage.limit === 0;
  const hasPets = pets.length > 0;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [petsRes, usageRes] = await Promise.all([
        supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!alive) return;
      const petList = petsRes.data ?? [];
      setPets(petList);
      // 펫 1마리 이상이면 첫 펫 자동 선택 — 1마리 유저는 별도 클릭 없이 분석 가능.
      if (petList.length > 0) setSelectedPetId(prev => prev ?? petList[0].id);
      if (usageRes) setUsage({ used: usageRes.photo.used, limit: usageRes.photo.limit, plan: usageRes.plan });
    })();
    return () => { alive = false; };
  }, [user]);

  if (authLoading) return <LoadingScreen />;
  if (!user) {
    router.replace('/login');
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능
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
          petId: selectedPet.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || '분석 중 오류가 발생했어요.');
        return;
      }
      setResult(data as AnalysisResult);
      // 사용량 갱신
      authFetch('/api/photo-analysis/usage').then(r => r.ok ? r.json() : null).then(u => {
        if (u) setUsage({ used: u.photo.used, limit: u.photo.limit, plan: u.plan });
      });
      // 결과 위치로 스크롤
      setTimeout(() => {
        document.getElementById('photo-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
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
      // 썸네일 IndexedDB 저장 (silent — 실패해도 보관함 자체는 작동)
      saveThumbnail(data.id, imageDataUrl);
    } catch {
      setSaveError('네트워크 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  const catHint = CATEGORIES.find(c => c.value === category)?.hint || '';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 상단 헤더 */}
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
          <h1 className="text-base font-bold">사진 증상 분석</h1>
          {usage && usage.limit > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              오늘 {usage.used}/{usage.limit}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Free 유저 안내 */}
        {isFreeNoQuota && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-start gap-2">
              <Sparkles size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-900">
                <p className="font-semibold mb-1">사진 분석은 Plus 기능이에요</p>
                <p className="text-xs leading-relaxed mb-3">
                  사진을 분석하려면 Plus 플랜이 필요해요. 텍스트 증상 분석은 무료로 사용할 수 있어요.
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

        {/* 펫 미등록 안내 — 사진 분석은 펫 컨텍스트 (나이/품종/만성질환/약) 가
            정확도에 큰 영향을 주므로 등록 펫이 있는 사용자만 허용. */}
        {!hasPets && (
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

        {/* 펫 선택 — 등록된 펫만. 1마리면 자동 선택, 2마리+ 면 칩으로 변경 가능. */}
        {hasPets && (
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

        {/* 카테고리 선택 */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 mb-2">사진 종류</h2>
          <div className="flex gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex-1 py-2 rounded-full text-xs font-medium ${
                  category === c.value ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">💡 {catHint}</p>
        </section>

        {/* 사진 업로드 */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 mb-2">사진</h2>
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
          {/* capture 속성을 빼서 모바일에서 카메라/갤러리 둘 다 액션 시트로 선택 가능.
              이전엔 capture="environment" 로 후면 카메라가 강제 실행돼 갤러리 접근이 어려웠음. */}
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

        {/* 보조 텍스트 */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 mb-2">
            보조 설명 <span className="text-gray-400 font-normal">(선택)</span>
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

        {/* 책임 제한 안내 (분석 전) */}
        <div className="text-[11px] text-gray-500 leading-relaxed px-1">
          ⚠️ AI 분석은 참고용이에요. 정확한 진단은 동물병원에서 받으셔야 해요.<br />
          사진은 서버에 저장되지 않아요. 분석 결과를 저장하면 이 기기 보관함에서만 사진을 다시 볼 수 있어요.
        </div>

        {/* 분석 버튼 — 펫 미선택/이미지 없음/Free 한도/분석 중일 땐 비활성 */}
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

        {/* 결과 */}
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

/**
 * 사진 분석 결과 패널.
 * Phase 2-F 에서 IndexedDB 썸네일 저장 + i 아이콘 안내를 추가할 컴포넌트.
 * 일단 inline 으로 두고 추후 분리.
 */
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

      {/* 저장 + 다른 사진 분석하기 */}
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
