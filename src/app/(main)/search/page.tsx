'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Search as SearchIcon, AlertTriangle, Pill, Loader2, X, Lock, Bookmark, Crown, Sparkles, Info, Stethoscope, ArrowRight, CircleAlert, HelpCircle, ShieldAlert, Dog, Cat, Camera } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';
import { usePubMedSearch, SearchStep, UsePubMedSearchResult } from '@/hooks/usePubMedSearch';
import { PaperSection } from '@/components/PaperSection';
import { useAuth } from '@/contexts/AuthContext';
import { DiseaseDescription } from '@/services/openai';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { TextField } from '@/components/TextField';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';

type SearchMode = 'disease' | 'symptom';

interface SymptomDisease {
  name_ko: string;
  name_en: string;
  /** 임상 분류 (옵셔널) — 예: "비뇨기 질환", "소화기 질환". AI 가 확실할 때만 채움. */
  category?: string;
  likelihood: '높음' | '중간' | '낮음';
  severity: '긴급' | '주의' | '관찰';
  description: string;
  matching_symptoms: string[];
  additional_symptoms: string[];
  action: string;
}

interface FollowupQuestion {
  question: string;
  type: 'yes_no' | 'select' | 'text';
  options?: string[];
}

// 응급 신호 — 서버에서 정규화돼 항상 객체 배열로 옴.
// severity 별로 UI 에서 색 분기 (즉시=빨강 / 24시간내=주황 / 경과관찰=노랑).
interface EmergencySign {
  sign: string;
  severity: '즉시' | '24시간내' | '경과관찰';
  reason?: string;
}

interface SymptomResult {
  diseases: SymptomDisease[];
  followup_questions: (string | FollowupQuestion)[];
  // 백워드 호환 — 옛 캐시는 string[] 일 수 있음. 정규화는 UI 단에서 처리.
  emergency_signs: (string | EmergencySign)[];
  // 펫 컨텍스트 사용 여부 + 이름 (서버에서 채움, 옵셔널).
  // 사용 시 결과 카드 상단에 "✨ 살구의 정보 반영" 배지 노출용.
  context_used?: boolean;
  pet_name?: string;
  // 보호자 불안 조절용 — 정상 가능성 평가.
  // low  : 정상 행동 가능성 큼 — 안심 메시지 + watch_signs + disease cards 작게
  // medium: 지켜볼 필요 — 기존 UI 톤
  // high : 적극 진료 권장 — 응급 강조
  // 옛 캐시는 없을 수 있어 옵셔널, 누락 시 'medium' 으로 취급.
  concern_level?: 'low' | 'medium' | 'high';
  reassurance?: string;
  watch_signs?: string[];
}

/** emergency_signs 정규화 — 캐시된 옛 형식 (string[]) 도 안전하게 처리. */
function normalizeEmergencySigns(
  list: (string | EmergencySign)[] | undefined
): EmergencySign[] {
  if (!list) return [];
  return list.map(s => {
    if (typeof s === 'string') return { sign: s, severity: '즉시' as const };
    return s;
  });
}

const stepMessages: Record<SearchStep, string> = {
  idle: '',
  validating: '검색어 확인 중...',
  searching: '논문 검색 중...',
  fetching: '논문 정보 가져오는 중...',
  analyzing: 'AI가 논문을 분석하고 있습니다...',
  done: '',
};

const severityConfig = {
  '긴급': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  '주의': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  '관찰': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', badge: 'bg-green-100 text-green-700' },
};

const likelihoodConfig = {
  '높음': 'bg-red-100 text-red-600',
  '중간': 'bg-yellow-100 text-yellow-700',
  '낮음': 'bg-gray-100 text-gray-500',
};

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // 사진 분석 onboarding 툴팁 — 첫 진입 1회만 노출. 사용자가 명시적으로
  // 닫거나 카메라 아이콘 누르면 localStorage 에 플래그 저장.
  const [showPhotoHint, setShowPhotoHint] = useState(false);
  const initialQuery = searchParams.get('q') || '';
  const initialPet = (searchParams.get('pet') as 'cat' | 'dog') || 'cat';
  const initialMode = (searchParams.get('mode') as SearchMode) || 'symptom';
  const { user, profile } = useAuth();
  const effectivePlan = getEffectivePlan(profile?.plan);
  const isPaid = effectivePlan === 'plus';
  const planConfig = getPlanConfig(effectivePlan);
  const maxSymptomLen = planConfig.maxSymptomLength;
  const storageKey = user ? `recentSearches_${user.id}` : null;

  // 세션 캐시 복원 규칙:
  // 1) searchedAt 이 30분 이내 (오래된 결과는 버림)
  // 2) URL ?q= 이 있으면 캐시의 query 와 일치해야 함 (외부 이동→복귀, 재하이드레이션 등)
  //    → 일치 시 재검색 스킵 (OpenAI 비용/10초 대기 모두 절약)
  //    → 불일치면 캐시 무시하고 새 검색
  // 3) URL ?q= 이 없으면 캐시 무조건 복원 (일반 진입)
  const CACHE_MAX_AGE = 30 * 60 * 1000;
  const [cached] = useState(() => {
    try {
      const raw = sessionStorage.getItem('searchCache');
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c.searchedAt || Date.now() - c.searchedAt > CACHE_MAX_AGE) return null;
      if (initialQuery && initialMode === 'disease' && c.query !== initialQuery) return null;
      return c;
    } catch { return null; }
  });

  const [cachedSymptom] = useState(() => {
    try {
      const raw = sessionStorage.getItem('symptomCache');
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c.searchedAt || Date.now() - c.searchedAt > CACHE_MAX_AGE) return null;
      if (initialQuery && initialMode === 'symptom' && c.query !== initialQuery) return null;
      return c;
    } catch { return null; }
  });

  // 각 탭이 독립된 입력창 state 를 가짐 — 탭 전환 시 서로 영향 없음.
  // 초기값: (1) 해당 탭 캐시에 쿼리가 있으면 그대로, (2) URL ?q= 이 있고 현재 탭 모드와 일치하면 그 값, (3) 없으면 공백.
  const [diseaseInput, setDiseaseInput] = useState<string>(() => {
    if (cached?.query) return cached.query;
    if (initialMode === 'disease' && initialQuery) return initialQuery;
    return '';
  });
  const [symptomInput, setSymptomInput] = useState<string>(() => {
    if (cachedSymptom?.query) return cachedSymptom.query;
    if (initialMode === 'symptom' && initialQuery) return initialQuery;
    return '';
  });
  const [petType, setPetType] = useState<'cat' | 'dog'>(cached?.petType || initialPet);
  // searchedPetType: 실제 검색에 사용된 pet (commit 값). petType 은 UI 토글의
  // pending 값. 토글만 바꿔도 자동 재검색되며 카운트가 빠지던 버그 때문에 분리.
  // handleSearch / clickSearchTerm 에서만 searchedPetType 을 업데이트 → 이때만
  // 훅의 deps 가 변경되어 재검색이 트리거됨.
  const [searchedPetType, setSearchedPetType] = useState<'cat' | 'dog'>(cached?.petType || initialPet);
  const [searchTerm, setSearchTerm] = useState<string | null>(cached?.searchTerm || null);
  const [mockResult, setMockResult] = useState<Disease | null>(cached?.mockResult || null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [cachedPubmed, setCachedPubmed] = useState<{ articles: any[]; analysis: any; diseaseDescription?: DiseaseDescription | null } | null>(
    cached ? { articles: cached.articles, analysis: cached.analysis, diseaseDescription: cached.diseaseDescription } : null
  );
  const [searchKey, setSearchKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(cached?.saved || false);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [symptomUsageInfo, setSymptomUsageInfo] = useState<{ search: { used: number; limit: number }; refine: { used: number; limit: number }; plan: string } | null>(null);
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<number>>(new Set());
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  // 완전 거부 / 완전 한도 도달 — 빨강. saveWarning(주황: 일부 잘림) 과 분리.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [symptomResult, setSymptomResult] = useState<SymptomResult | null>(cachedSymptom?.result || null);
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomError, setSymptomError] = useState<string | null>(null);
  const [symptomQuery, setSymptomQuery] = useState<string | null>(cachedSymptom?.query || null);
  const [followupAnswers, setFollowupAnswers] = useState<Record<number, string>>({});
  const [isRefining, setIsRefining] = useState(false);
  const [refineLimit, setRefineLimit] = useState<string | null>(null);
  // 증상 분석 에러 UI 아이콘 분기용: true 면 자물쇠(한도 초과), false 면 ⚠️(네트워크/기타).
  const [symptomLimitReached, setSymptomLimitReached] = useState(false);

  // 한 증상 분석 세션 내 누적된 follow-up 질문 — 재분석 시 AI 가 같은 질문 반복하지
  // 않도록 서버에 모두 전달. "새 증상 분석 시작" 시 리셋 (handleSearch 에서 처리).
  // 한도 모델은 일일 풀(3회/일)이지만, 누적은 "현재 분석 세션" 단위로 함.
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);

  // 펫 컨텍스트 — 증상 분석 시 특정 펫 선택 시 그 펫의 의료 정보를 AI 에 자동 주입.
  // pets: 사용자 등록 펫 목록 (없으면 빈 배열).
  // selectedPetId: null = "전체"(컨텍스트 미사용, 기존 강아지/고양이 토글로 fallback).
  // 초기값 — 캐시에 petId 있으면 복원 (다른 탭 갔다 와도 선택 유지).
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(cachedSymptom?.petId ?? null);
  const selectedPet = selectedPetId ? pets.find(p => p.id === selectedPetId) ?? null : null;
  // 효과적 종 — 펫 선택 시 그 펫의 type, 미선택 시 토글 값.
  const effectivePetType: 'cat' | 'dog' = selectedPet?.type ?? petType;

  // symptom 탭 활성 중엔 훅에 null 을 넘겨서 pet 토글 같은 외부 deps 변화가
  // 유발하는 백그라운드 disease fetch 를 완전 차단. (예: 증상 탭에서 pet 을
  // 바꿨다고 disease 가 몰래 재검색 + 카운트 차감되는 사고 방지)
  // disease 탭으로 돌아오면 훅 내부 dedup(lastFetchRef) 이 이전 결과에 대한
  // 중복 fetch 를 막으므로 articles state 는 그대로 보존됨.
  const pubmed = usePubMedSearch(
    cachedPubmed ? null : (searchMode === 'disease' ? searchTerm : null),
    searchedPetType,
    searchKey,
  );

  const displayPubmed: UsePubMedSearchResult = cachedPubmed ? {
    articles: cachedPubmed.articles,
    analysis: cachedPubmed.analysis,
    loading: false,
    analysisLoading: false,
    step: 'done' as SearchStep,
    error: null,
    retry: () => { setCachedPubmed(null); },
    diseaseDescription: cachedPubmed.diseaseDescription || null,
    isCached: false,
    pendingCount: false,
    lastLogResult: null,
  } : pubmed;

  // Init bookmarks for cached results
  useEffect(() => {
    if (cachedPubmed && cachedPubmed.articles.length > 0 && bookmarkedPapers.size === 0) {
      setBookmarkedPapers(new Set(cachedPubmed.articles.map((_, i) => i)));
    }
  }, [cachedPubmed]);

  // 논문 검색 배지 초기값 — 마운트 시 1회만 서버에서 가져옴.
  // 이후 갱신은 usePubMedSearch 의 logSearch 응답으로 처리 (race 없음).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/search-usage');
        if (alive && res.ok) {
          const data = await res.json();
          setUsageInfo({ used: data.used, limit: data.limit, plan: data.plan });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // 훅이 logSearch 응답으로 받은 "서버 진실" 카운트를 배지에 반영.
  // 이 시점에는 실제 INSERT 가 완료된 상태라 한 번만 덮어쓰면 일관성 OK.
  useEffect(() => {
    if (pubmed.lastLogResult) {
      setUsageInfo(prev => prev
        ? { ...prev, used: pubmed.lastLogResult!.used, limit: pubmed.lastLogResult!.limit }
        : { used: pubmed.lastLogResult!.used, limit: pubmed.lastLogResult!.limit, plan: 'free' }
      );
    }
  }, [pubmed.lastLogResult]);

  // 사진 분석 onboarding 툴팁 — 증상 모드 진입 + 미경험 사용자에게 1회 노출.
  // 5초 후 자동 fade-out. 카메라 클릭 시에도 즉시 사라짐 + 플래그 저장.
  useEffect(() => {
    if (searchMode !== 'symptom') return;
    let onboarded = false;
    try { onboarded = localStorage.getItem('photo-analysis-onboarded-v1') === '1'; } catch {}
    if (onboarded) return;
    const showTimer = setTimeout(() => setShowPhotoHint(true), 600);
    const hideTimer = setTimeout(() => {
      setShowPhotoHint(false);
      try { localStorage.setItem('photo-analysis-onboarded-v1', '1'); } catch {}
    }, 5600);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [searchMode]);

  // 증상 분석 배지 초기값 — 마운트 시 1회.
  // 이후 갱신은 /api/symptom-analysis 응답의 data.usage 로 처리.
  useEffect(() => {
    if (searchMode !== 'symptom' || !user) return;
    let alive = true;
    (async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/symptom-usage');
        if (alive && res.ok) {
          const data = await res.json();
          setSymptomUsageInfo(data);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [searchMode, user?.id]);

  // 펫 목록 fetch — 증상 분석 시 펫 선택 칩에 사용. 마운트 시 1회 가져옴.
  // 미등록 유저는 빈 배열 → 칩 영역 자체가 렌더되지 않음 (기존 강아지/고양이
  // 토글만 보임 → 기존 UX 그대로 유지).
  //
  // 캐시된 selectedPetId 가 실제 존재하지 않으면 (펫 삭제 등) null 로 reset →
  // 잘못된 ID 가 서버로 가지 않도록 방어.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('pets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (!alive) return;
        const defaultId = readDefaultPetId();
        const petList = sortPetsWithDefault(data ?? [], defaultId);
        setPets(petList);
        setSelectedPetId(prev => {
          // 1) 현재 선택이 유효하면 유지
          if (prev && petList.some(p => p.id === prev)) return prev;
          // 2) 이전 분석 캐시가 있으면 그 선택을 존중 (사용자가 '전체'=null 로 둔 것도 존중)
          if (cachedSymptom) {
            return cachedSymptom.petId && petList.some(p => p.id === cachedSymptom.petId)
              ? cachedSymptom.petId
              : null;
          }
          // 3) 신규 진입 — 기본 반려동물(정렬상 첫 번째) 자동 선택. 펫 없으면 '전체'.
          return petList[0]?.id ?? null;
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'pets', action: 'search-fetch' } });
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!storageKey) { setRecentSearches([]); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRecentSearches(JSON.parse(saved));
      else setRecentSearches([]);
    } catch {}
  }, [storageKey]);

  const saveHistory = (searches: string[]) => {
    setRecentSearches(searches);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(searches));
  };

  // Auto-bookmark all papers when results arrive
  useEffect(() => {
    if (pubmed.step === 'done' && pubmed.articles.length > 0) {
      setBookmarkedPapers(new Set(pubmed.articles.map((_, i) => i)));
    }
  }, [pubmed.step, pubmed.articles]);

  useEffect(() => {
    if (pubmed.step === 'done' && searchTerm && pubmed.articles.length > 0) {
      try {
        sessionStorage.setItem('searchCache', JSON.stringify({
          // cache.query 는 "이 캐시가 어떤 검색에 속하는가" 식별자 — searchTerm 과 같게 유지.
          query: searchTerm,
          // 실제 검색에 쓰인 searchedPetType 을 저장해야 복귀 시 UI 토글과 결과가 일치.
          petType: searchedPetType, searchTerm, mockResult, saved,
          articles: pubmed.articles,
          analysis: pubmed.analysis,
          diseaseDescription: pubmed.diseaseDescription,
          searchedAt: Date.now(),  // 복원 시 stale 체크용
        }));
      } catch {}
    }
  }, [pubmed.step, pubmed.articles, pubmed.analysis, pubmed.diseaseDescription, searchedPetType, searchTerm, mockResult, saved]);

  // Cache symptom results in sessionStorage.
  // petId 도 캐시 — 다른 탭 갔다 와도 펫 선택 유지 → 재분석 시 동일 펫 컨텍스트 적용.
  // (캐시 빠질 때 재분석이 "전체" 로 진행되어 ✨ 배지 사라지던 버그 fix)
  useEffect(() => {
    if (symptomResult && symptomQuery) {
      try {
        sessionStorage.setItem('symptomCache', JSON.stringify({
          query: symptomQuery,
          petType: searchedPetType,
          petId: selectedPetId,
          result: symptomResult,
          searchedAt: Date.now(),
        }));
      } catch {}
    }
  }, [symptomResult, symptomQuery, searchedPetType, selectedPetId]);

  useEffect(() => {
    if (!initialQuery) return;

    // 캐시가 이미 같은 쿼리로 복원된 상태면 재검색 불필요.
    // 외부 링크 다녀온 뒤 복귀하거나 모바일 브라우저가 페이지를 re-hydrate 한 경우
    // 이 가드가 없으면 검색이 한 번 더 트리거되며 OpenAI 검증에서 REJECT 받고
    // "반려동물 질병이나 증상과 관련된 검색어를 입력해주세요" 화면이 뜸.
    const diseaseHit = initialMode === 'disease' && cached?.searchTerm === initialQuery;
    const symptomHit = initialMode === 'symptom' && cachedSymptom?.query === initialQuery;
    if (diseaseHit || symptomHit) {
      // state 는 캐시로 이미 초기화되어 있음. 최근 검색어 동기화만 해주고 종료.
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          const existing: string[] = saved ? JSON.parse(saved) : [];
          const updated = [initialQuery, ...existing.filter(s => s !== initialQuery)].slice(0, 10);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setRecentSearches(updated);
        } catch {}
      }
      return;
    }

    // (main) 레이아웃이 미인증 유저를 /login 으로 리다이렉트하므로 여기선 user 가 항상 있음
    setSearchTerm(initialQuery);
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        const existing: string[] = saved ? JSON.parse(saved) : [];
        const updated = [initialQuery, ...existing.filter(s => s !== initialQuery)].slice(0, 10);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setRecentSearches(updated);
      } catch {}
    }
    if (initialMode === 'symptom') {
      setSymptomQuery(initialQuery);
      handleSymptomSearch(initialQuery);
    } else {
      const found = mockDiseases.find(d => d.name.includes(initialQuery));
      setMockResult(found || null);
    }
  }, [initialQuery, user, storageKey]);


  const handleSymptomSearch = async (q: string, answers?: { question: string; answer: string }[]) => {
    const isRefine = !!answers;
    if (isRefine) {
      setIsRefining(true);
    } else {
      setSymptomLoading(true);
      setSymptomError(null);
      setSymptomResult(null);
      setFollowupAnswers({});
      setRefineLimit(null);
      setSymptomLimitReached(false);  // 새 시도 시작 시 리셋
      // 새 증상 분석 시작 → 누적된 질문 리셋. 이 분석의 자체 누적이 새로 시작됨.
      setAskedQuestions([]);
    }
    try {
      const { authFetch } = await import('@/lib/authFetch');

      const res = await authFetch('/api/symptom-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: q,
          // effectivePetType: 펫 선택 시 그 펫의 type, 미선택 시 토글 값.
          petType: effectivePetType,
          // petId 옵셔널 — 있으면 서버가 펫 의료 정보 fetch → 프롬프트에 주입.
          ...(selectedPetId ? { petId: selectedPetId } : {}),
          // 재분석 시 — 누적된 모든 이전 질문 전달 (여러 라운드 재분석에도
          // AI 가 같은 질문 반복하지 않게). 빈 배열이면 서버에서 처리 안 함.
          ...(isRefine && askedQuestions.length > 0 ? { previousQuestions: askedQuestions } : {}),
          ...(isRefine ? { followupAnswers: answers } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429 && errData.limitReached) {
          if (isRefine) {
            setRefineLimit(errData.error || '재분석 횟수를 초과했습니다.');
          } else {
            setSymptomError(errData.error || '증상 분석 횟수를 초과했습니다.');
            setSymptomLimitReached(true);  // 한도 초과 → 자물쇠 아이콘
          }
        } else if (!isRefine) {
          // 네트워크/서버 에러: 2줄 한글 메시지로 정규화.
          setSymptomError('증상 분석에 실패했습니다.\n네트워크 연결을 확인해주세요.');
        }
        return;
      }
      const data = await res.json();
      setSymptomResult(data);
      setFollowupAnswers({});
      // 새 응답의 follow-up 질문을 누적 — 다음 재분석 시 서버에 전달돼 중복 방지.
      // Set 으로 중복 제거 (같은 질문이 두 번 누적되지 않게).
      if (Array.isArray(data.followup_questions)) {
        const newQs = data.followup_questions
          .map((q: string | FollowupQuestion) => getQuestionText(q))
          .filter((q: string) => typeof q === 'string' && q.trim().length > 0);
        if (newQs.length > 0) {
          setAskedQuestions(prev => Array.from(new Set([...prev, ...newQs])));
        }
      }
      // 재분석 시 결과 카드가 입력창 아래 멀리 있으면 사용자가 변화를 놓침 →
      // 페이지 맨 위로 스크롤. scrollIntoView 는 sticky 헤더(top-14)가 덮어서
      // 결과가 중간에 걸려보이는 문제가 있어 window.scrollTo 로 교체.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      // 서버가 응답에 끼워준 최신 사용량으로 배지 즉시 갱신.
      // 별도 GET /api/symptom-usage race 없이 정확한 값.
      // symptomUsageInfo 가 아직 null 일 수 있으므로 prev null 도 받아서 초기화
      // (홈에서 바로 mode=symptom&q=... 로 진입한 경우 초기 GET 보다 POST 가
      //  먼저 돌아올 수 있음 — 논문 검색 쪽과 같은 패턴으로 처리).
      if (data.usage) {
        const u = data.usage as { kind: string; used: number; limit: number };
        setSymptomUsageInfo(prev => {
          if (u.kind === 'symptom_refine') {
            return prev
              ? { ...prev, refine: { used: u.used, limit: u.limit } }
              : { plan: 'free', search: { used: 0, limit: 0 }, refine: { used: u.used, limit: u.limit } };
          }
          return prev
            ? { ...prev, search: { used: u.used, limit: u.limit } }
            : { plan: 'free', search: { used: u.used, limit: u.limit }, refine: { used: 0, limit: 0 } };
        });
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'symptom', action: 'analyze' },
        extra: { isRefine },
      });
      if (!isRefine) setSymptomError('증상 분석에 실패했습니다.\n네트워크 연결을 확인해주세요.');
    } finally {
      setSymptomLoading(false);
      setIsRefining(false);
    }
  };

  const getQuestionText = (q: string | FollowupQuestion): string => {
    return typeof q === 'string' ? q : q.question;
  };

  const getQuestionType = (q: string | FollowupQuestion): 'yes_no' | 'select' | 'text' => {
    return typeof q === 'string' ? 'yes_no' : (q.type || 'yes_no');
  };

  const getQuestionOptions = (q: string | FollowupQuestion): string[] => {
    return typeof q === 'string' ? [] : (q.options || []);
  };

  const handleRefineAnalysis = () => {
    if (!symptomQuery || !symptomResult) return;
    const answers = Object.entries(followupAnswers)
      .filter(([, v]) => v.trim())
      .map(([idx, answer]) => ({
        question: getQuestionText(symptomResult.followup_questions[Number(idx)]),
        answer,
      }));
    if (answers.length === 0) return;
    handleSymptomSearch(symptomQuery, answers);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 현재 탭의 입력값을 사용. 각 탭이 독립 state 라 반대 탭 값은 안 건드림.
    const rawInput = searchMode === 'disease' ? diseaseInput : symptomInput;
    if (!rawInput.trim()) return;
    const q = rawInput.trim();
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10);
    saveHistory(updated);

    if (searchMode === 'symptom') {
      // 펫 선택 시 그 펫의 type, 아니면 토글 값. (symptomResult 캐시 키와 일관)
      setSearchedPetType(effectivePetType);
      handleSymptomSearch(q);
      setSymptomQuery(q);
      return;
    }

    setCachedPubmed(null);
    setSaved(false);
    const found = mockDiseases.find(d => d.name.includes(q));
    setMockResult(found || null);
    setSearchedPetType(petType);
    setSearchTerm(q);
    setSearchKey(k => k + 1);
  };

  const deleteSearchTerm = (term: string) => {
    saveHistory(recentSearches.filter(s => s !== term));
  };

  const clickSearchTerm = (term: string) => {
    // 최근 검색어 칩 클릭 — input 만 채움. 사용자가 돋보기 버튼을 눌러야 실제 검색 실행.
    // (자동 검색이 사용자 의도와 어긋남: 칩 클릭 → 추가 작성하려는데 즉시 검색돼 버림)
    if (searchMode === 'symptom') {
      setSymptomInput(term);
    } else {
      setDiseaseInput(term);
    }
  };

  const toggleBookmark = (idx: number) => {
    setBookmarkedPapers(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveAnalysis = async () => {
    if (!isPaid || saving || saved) return;
    if (!searchTerm) return; // 검색하지 않은 상태에서는 저장 불가
    setSaving(true);
    try {
      const { authFetch } = await import('@/lib/authFetch');

      // Build selected papers array from bookmarked papers
      const papers = Array.from(bookmarkedPapers).map(idx => {
        const article = displayPubmed.articles[idx];
        return {
          pmid: article.pmid,
          title: article.title,
          titleKo: displayPubmed.analysis?.titles?.[idx] || null,
          summary: displayPubmed.analysis?.summaries?.[idx] || null,
          journal: article.journal,
          pubDate: article.pubDate,
        };
      });

      const res = await authFetch('/api/saved-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTerm,
          petType,
          analysis: displayPubmed.analysis,
          selectedPapers: papers,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setSaved(true);
        setSaveError(null);
        if (result.warning) {
          // warningKind: 'partial' = 주황(일부 잘림), 'limit_reached' = 빨강(완전 도달)
          if (result.warningKind === 'limit_reached') {
            setSaveError(result.warning);
            setSaveWarning(null);
          } else {
            setSaveWarning(result.warning);
          }
        }
        try {
          const raw = sessionStorage.getItem('searchCache');
          if (raw) {
            const c = JSON.parse(raw);
            c.saved = true;
            sessionStorage.setItem('searchCache', JSON.stringify(c));
          }
        } catch {}
      } else {
        // 403 (논문 분석 cap 도달, plus 가 500편 채운 케이스) — 빨강.
        setSaveError(result?.error || '저장에 실패했어요.');
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'search', action: 'save-analysis' },
      });
      setSaveError('네트워크 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  const hasSearched = searchMode === 'disease' ? searchTerm !== null : (symptomQuery !== null);
  const hasResults = displayPubmed.articles.length > 0 && displayPubmed.step === 'done';
  const desc = displayPubmed.diseaseDescription;
  // AI 분석 실패 감지: 검색은 끝났고 논문은 있는데 analysis 가 비어있음.
  // usePubMedSearch 의 catch(aiErr) 경로에서 setArticles 만 하고 analysis 를 세팅
  // 못 하는 케이스 (비행기 모드 / OpenAI 타임아웃 등). 이 상태에서 "분석 중..."
  // 같은 유령 메시지가 계속 보이면 혼란스러우므로 명시적 배너로 바꿈.
  const aiFailed =
    displayPubmed.step === 'done' &&
    displayPubmed.articles.length > 0 &&
    !displayPubmed.analysisLoading &&
    !displayPubmed.analysis;
  // AI 실패 시엔 북마크 보관 UI 도 의미 없음 (저장할 AI 분석이 없음)
  const showBottomBar = hasResults && isPaid && searchMode === 'disease' && !aiFailed;

  return (
    <div className="flex flex-col h-full bg-white min-h-[calc(100vh-8rem)]">
      {/* Search Header */}
      <div className="bg-white px-4 pt-6 pb-4 sticky top-12 z-40">
        {/* Mode Toggle */}
        <div className="max-w-sm mx-auto mb-3 flex justify-center">
          <div className="flex bg-gray-100 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => {
                // 각 탭이 독립된 input/result state 를 가지므로 탭 전환 시
                // 상태를 건드리지 않아도 된다. 자동 재검색도 훅의 lastFetchRef dedup 이 막음.
                if (searchMode === 'symptom') return;
                setSearchMode('symptom');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                searchMode === 'symptom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Stethoscope size={12} className="inline mr-1 -mt-0.5" />
              증상 분석
            </button>
            <button
              type="button"
              onClick={() => {
                if (searchMode === 'disease') return;
                setSearchMode('disease');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                searchMode === 'disease' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <SearchIcon size={12} className="inline mr-1 -mt-0.5" />
              논문 검색
            </button>
          </div>
        </div>

        {/* 펫 칩 줄 — 증상 분석 모드 + 등록 펫 있을 때만 노출.
            "전체"(미선택) 일 땐 기존 강아지/고양이 토글로 fallback → 펫 미등록
            유저나 일반 질문하고 싶은 유저 UX 유지. */}
        {searchMode === 'symptom' && pets.length > 0 && (
          <div className="max-w-sm mx-auto mb-2 flex gap-1.5 overflow-x-auto px-1">
            <button
              type="button"
              onClick={() => setSelectedPetId(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedPetId === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              전체
            </button>
            {pets.map(pet => {
              const active = selectedPetId === pet.id;
              const Icon = pet.type === 'dog' ? Dog : Cat;
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setSelectedPetId(pet.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={12} />
                  {pet.name}
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSearch} className="max-w-sm mx-auto">
          <div className={`flex items-center rounded-full border shadow-sm hover:shadow-md transition-shadow px-1.5 py-1 ${
            searchMode === 'symptom' ? 'border-blue-300' : 'border-violet-200'
          }`}>
            {(searchMode === 'symptom' && selectedPet) ? (
              // 증상 분석 + 펫 선택 시에만 — 종 이름 + 아이콘 (표시만, 변경은 위 칩 줄에서).
              // 논문 검색 모드에선 펫 선택과 무관하게 항상 강아지/고양이 토글만 노출.
              <div
                className="h-8 rounded-full px-3 flex items-center justify-center flex-shrink-0 text-xs font-medium gap-1 bg-blue-50 text-blue-600"
              >
                {selectedPet.type === 'dog' ? <Dog size={12} /> : <Cat size={12} />}
                {selectedPet.name}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
                className={`h-8 rounded-full px-3 flex items-center justify-center flex-shrink-0 transition-colors text-xs font-medium ${
                  searchMode === 'symptom' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
                }`}
              >
                {petType === 'dog' ? '강아지' : '고양이'} ⇄
              </button>
            )}
            {/* input 과 돋보기 버튼을 한 묶음으로. min-w-0 가 input intrinsic min-width
                를 풀어줘서 폰트 크기 확대 시에도 submit 버튼이 바깥으로 밀리지 않음. */}
            <div className="relative flex-1 min-w-0">
              <input
                type="search"
                value={searchMode === 'disease' ? diseaseInput : symptomInput}
                onChange={(e) => {
                  if (searchMode === 'symptom') {
                    if (e.target.value.length > maxSymptomLen) return;
                    setSymptomInput(e.target.value);
                  } else {
                    setDiseaseInput(e.target.value);
                  }
                }}
                maxLength={searchMode === 'symptom' ? maxSymptomLen : 100}
                placeholder={searchMode === 'symptom' ? '증상을 검색하세요' : '질병·키워드를 검색하세요'}
                autoComplete="off"
                enterKeyHint="search"
                className={`w-full h-9 pl-3 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 appearance-none [&::-webkit-search-cancel-button]:hidden ${
                  searchMode === 'symptom' ? 'pr-[72px]' : 'pr-10'
                }`}
              />
              {/* 증상 모드에만 사진 분석 진입 버튼 — 돋보기 왼쪽. */}
              {searchMode === 'symptom' && (
                <button
                  type="button"
                  aria-label="사진으로 분석하기"
                  onClick={() => {
                    try { localStorage.setItem('photo-analysis-onboarded-v1', '1'); } catch {}
                    setShowPhotoHint(false);
                    router.push('/search/photo');
                  }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Camera size={18} />
                  {showPhotoHint && (
                    <span
                      className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-white border border-blue-300 text-blue-600 text-[11px] font-medium px-2.5 py-1.5 shadow-md z-20"
                      role="tooltip"
                    >
                      📷 사진으로 분석하기!
                      {/* 아래 방향 꼬리 — 카메라 아이콘 가리키게. border 색과 동일 톤. */}
                      <span className="absolute -bottom-1 right-3 w-2 h-2 bg-white border-r border-b border-blue-300 rotate-45" />
                    </span>
                  )}
                </button>
              )}
              <button
                type="submit"
                aria-label="검색"
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                  searchMode === 'symptom' ? 'text-gray-400 hover:text-blue-600' : 'text-gray-400 hover:text-violet-600'
                }`}
              >
                <SearchIcon size={18} />
              </button>
            </div>
          </div>
        </form>
        {/* Usage count badge (+ symptom 모드 글자수). 한 줄에 왼쪽 카운트 · 오른쪽 글자수 배치로 헤더 세로공간 절약. */}
        {searchMode === 'disease' && usageInfo && (() => {
          // Optimistic 표시: logSearch POST 가 비행 중이면 +1 즉시 반영.
          // 서버 응답이 오면 useEffect [lastLogResult] 가 usageInfo.used 를 확정값으로 덮어씀.
          const displayUsed = usageInfo.used + (pubmed.pendingCount ? 1 : 0);
          return (
            <div className="max-w-sm mx-auto mt-2 flex justify-center">
              <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                isPaid ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
              }`}>
                {isPaid ? (
                  <><Sparkles size={10} /> Plus {displayUsed}/{usageInfo.limit}</>
                ) : (
                  <>Free {displayUsed}/{usageInfo.limit}</>
                )}
              </span>
            </div>
          );
        })()}
        {searchMode === 'symptom' && (symptomUsageInfo || symptomInput.length > 0) && (
          // 배지는 항상 중앙, 글자수는 우측 absolute — 입력이 시작돼도 배지
          // 위치가 움직이지 않아서 눈에 튀지 않음.
          <div className="relative max-w-sm mx-auto mt-2 flex justify-center items-center px-1 min-h-[22px]">
            {symptomUsageInfo && (
              <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                isPaid ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
              }`}>
                {isPaid ? (
                  <><Sparkles size={10} /> Plus {symptomUsageInfo.search.used}/{symptomUsageInfo.search.limit}</>
                ) : (
                  <>Free {symptomUsageInfo.search.used}/{symptomUsageInfo.search.limit}</>
                )}
              </span>
            )}
            {symptomInput.length > 0 && (
              <span className={`absolute right-1 text-[10px] ${symptomInput.length >= maxSymptomLen ? 'text-red-400' : 'text-gray-400'}`}>
                {symptomInput.length}/{maxSymptomLen}자
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`flex-1 px-4 pb-4 ${showBottomBar ? 'pb-20' : ''}`}>
        {/* Symptom Mode Results */}
        {searchMode === 'symptom' && (symptomLoading || symptomResult || symptomError) ? (
          <div className="max-w-sm mx-auto space-y-4">
            {symptomLoading && (
              <div className="flex items-center gap-2.5 p-4 rounded-xl bg-blue-50">
                <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">AI가 증상을 분석하고 있습니다...</p>
              </div>
            )}

            {symptomError && (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {/* 한도 초과 = 자물쇠, 네트워크/기타 에러 = ⚠️ — 논문 검색과 아이콘 기준 통일 */}
                  {symptomLimitReached ? (
                    <Lock size={24} className="text-gray-400" />
                  ) : (
                    <AlertTriangle size={24} className="text-gray-400" />
                  )}
                </div>
                {(() => {
                  const lines = symptomError.split('\n');
                  return (
                    <>
                      <p className="text-sm text-gray-600 font-medium">{lines[0]}</p>
                      {lines[1] && (
                        <p className="text-[11px] text-gray-400 mt-1">{lines[1]}</p>
                      )}
                    </>
                  );
                })()}
                {/* 업그레이드 배너는 한도 초과일 때만 (네트워크 오류엔 부적절) */}
                {symptomLimitReached && !isPaid && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Crown size={16} className="text-purple-500" />
                      <p className="text-sm font-bold text-gray-700">우리 아이 건강, 빈틈없이 케어하기</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">더 많은 검색 · 푸시 알림 · 분석 보관 · 기록장 확장</p>
                    <button
                      onClick={() => window.location.href = '/profile/subscription'}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium"
                    >
                      요금제 보기
                    </button>
                  </div>
                )}
              </div>
            )}

            {symptomResult && (
              <>
                {/* 펫 컨텍스트 사용 시 배지 — 분석에 펫 의료 정보가 반영됐음을 명시.
                   유저가 "이 분석이 우리 펫에 맞춤화됐구나" 인지하도록 결과 카드 위에 배치. */}
                {symptomResult.context_used && symptomResult.pet_name && (
                  <div className="flex items-center gap-1.5 px-1">
                    <Sparkles size={13} className="text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">{symptomResult.pet_name}</span>
                      의 정보를 반영한 분석이에요
                    </p>
                  </div>
                )}

                {/* 안심 카드 — concern_level 이 low/medium 이고 reassurance 가 있을 때.
                   low (정상 가능성 큼) 은 녹색 톤, medium 은 파란 톤으로 부드럽게.
                   high 일 땐 응급 신호 강조에 집중 — 안심 카드 의도적으로 생략. */}
                {(symptomResult.concern_level === 'low' || symptomResult.concern_level === 'medium') &&
                  symptomResult.reassurance && (
                  <div className={`rounded-xl border p-4 ${
                    symptomResult.concern_level === 'low'
                      ? 'bg-green-50 border-green-100'
                      : 'bg-blue-50 border-blue-100'
                  }`}>
                    <p className={`text-xs leading-relaxed ${
                      symptomResult.concern_level === 'low' ? 'text-green-800' : 'text-blue-800'
                    }`}>
                      {/* low=😊 안심 / medium=🔍 관찰 (아래 진료 권장 헤더는 🩺 청진기) */}
                      {symptomResult.concern_level === 'low' ? '😊 ' : '🔍 '}
                      {symptomResult.reassurance}
                    </p>

                    {/* watch_signs — "이런 경우엔 진료를" 신호.
                       low/medium 에서 함께 표시되어 정상 가능성 + 주의 신호를 한 번에 전달. */}
                    {symptomResult.watch_signs && symptomResult.watch_signs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current/10">
                        <p className={`text-[11px] font-semibold mb-1.5 ${
                          symptomResult.concern_level === 'low' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          🩺 이런 경우엔 진료를 고려하세요
                        </p>
                        <ul className="space-y-1">
                          {symptomResult.watch_signs.map((sign, i) => (
                            <li key={i} className={`flex items-start gap-1.5 text-[11px] ${
                              symptomResult.concern_level === 'low' ? 'text-green-700' : 'text-blue-700'
                            }`}>
                              <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0" />
                              {sign}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* concern_level=low 일 때 "참고용 의심 질환" 헤더 — 톤 차분 ↓.
                   분석 결과는 그대로 보여주되 "확정 진단 X, 참고용" 임을 명시. */}
                {symptomResult.concern_level === 'low' && symptomResult.diseases.length > 0 && (
                  <p className="text-[11px] text-gray-400 -mb-1">
                    ─── 참고로 가능성 있는 질환 ───
                  </p>
                )}

                {/* Disease Cards */}
                {symptomResult.diseases.map((disease, idx) => {
                  const sev = severityConfig[disease.severity] || severityConfig['관찰'];
                  const lik = likelihoodConfig[disease.likelihood] || likelihoodConfig['낮음'];
                  return (
                    <div key={idx} className={`rounded-xl border ${sev.border} ${sev.bg} p-4 space-y-3`}>
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">
                            {disease.name_ko}
                            {disease.name_en && <span className="text-xs text-gray-400 font-normal ml-1.5">({disease.name_en})</span>}
                          </h3>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.badge}`}>
                            {disease.severity || '관찰'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${lik}`}>
                            가능성 {disease.likelihood || '낮음'}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-600 leading-relaxed">{disease.description}</p>

                      {/* Matching symptoms */}
                      {disease.matching_symptoms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1">일치하는 증상</p>
                          <div className="flex flex-wrap gap-1">
                            {disease.matching_symptoms.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/80 text-gray-700 rounded-full text-[11px] font-medium border border-gray-200">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Additional symptoms to watch */}
                      {disease.additional_symptoms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1">추가로 관찰할 증상</p>
                          <div className="flex flex-wrap gap-1">
                            {disease.additional_symptoms.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/50 text-gray-500 rounded-full text-[11px] border border-dashed border-gray-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action */}
                      <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2.5">
                        <ArrowRight size={14} className={`${sev.text} mt-0.5 flex-shrink-0`} />
                        <p className="text-xs text-gray-700 font-medium">{disease.action}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Emergency Signs — severity 별 색 분기.
                   '즉시'=빨강 (대표), '24시간내'=주황, '경과관찰'=노랑.
                   가장 심한 severity 를 카드 전체 톤으로 사용. */}
                {symptomResult.emergency_signs.length > 0 && (() => {
                  const signs = normalizeEmergencySigns(symptomResult.emergency_signs);
                  if (signs.length === 0) return null;
                  // 가장 심한 severity 결정 (즉시 > 24시간내 > 경과관찰)
                  const severityRank: Record<EmergencySign['severity'], number> = {
                    '즉시': 3, '24시간내': 2, '경과관찰': 1,
                  };
                  const topSeverity = signs.reduce<EmergencySign['severity']>(
                    (max, s) => severityRank[s.severity] > severityRank[max] ? s.severity : max,
                    '경과관찰',
                  );
                  const headerByTop: Record<EmergencySign['severity'], { bg: string; border: string; text: string; title: string }> = {
                    '즉시': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', title: '이런 증상이면 즉시 병원으로' },
                    '24시간내': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', title: '이런 증상이면 24시간 내 병원으로' },
                    '경과관찰': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', title: '이런 증상이면 경과를 주의 깊게' },
                  };
                  const itemColorByTier: Record<EmergencySign['severity'], string> = {
                    '즉시': 'text-red-700',
                    '24시간내': 'text-orange-700',
                    '경과관찰': 'text-yellow-800',
                  };
                  const itemBadgeByTier: Record<EmergencySign['severity'], string> = {
                    '즉시': 'bg-red-100 text-red-700',
                    '24시간내': 'bg-orange-100 text-orange-700',
                    '경과관찰': 'bg-yellow-100 text-yellow-800',
                  };
                  const header = headerByTop[topSeverity];
                  return (
                    <div className={`${header.bg} border ${header.border} rounded-xl p-4`}>
                      <h4 className={`flex items-center gap-1.5 text-xs font-bold ${header.text} mb-2`}>
                        <ShieldAlert size={14} />
                        {header.title}
                      </h4>
                      <ul className="space-y-1.5">
                        {signs.map((item, i) => (
                          <li key={i} className={`flex items-start gap-2 text-xs ${itemColorByTier[item.severity]}`}>
                            <CircleAlert size={12} className="mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1.5 flex-wrap">
                                {/* 타이틀이 이미 최상위 severity 를 표기 → 같은 등급 항목엔 뱃지 생략(중복).
                                    다른 등급(예: 즉시 카드 안의 24시간내)만 뱃지로 구분. */}
                                {item.severity !== topSeverity && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${itemBadgeByTier[item.severity]}`}>
                                    {item.severity}
                                  </span>
                                )}
                                <span className="font-medium">{item.sign}</span>
                              </div>
                              {item.reason && (
                                <p className="text-[11px] opacity-80 mt-0.5">{item.reason}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Interactive Follow-up Questions — 재분석 소진 시에도 표시(버튼만 비활성화) */}
                {symptomResult.followup_questions.length > 0 && (() => {
                  const totalQ = symptomResult.followup_questions.length;
                  const answeredCount = symptomResult.followup_questions.filter(
                    (_, i) => (followupAnswers[i] ?? '').trim().length > 0
                  ).length;
                  const refineExhausted = refineLimit != null ||
                    (!!symptomUsageInfo && symptomUsageInfo.refine.used >= symptomUsageInfo.refine.limit);
                  return (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                      <HelpCircle size={14} />
                      추가 질문에 답하면 더 정확해져요
                      {symptomUsageInfo && (
                        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                          재분석 {symptomUsageInfo.refine.used}/{symptomUsageInfo.refine.limit}
                        </span>
                      )}
                    </h4>
                    <div className="space-y-3">
                      {symptomResult.followup_questions.map((q, i) => {
                        const qType = getQuestionType(q);
                        const qText = getQuestionText(q);
                        const qOptions = getQuestionOptions(q);
                        return (
                          <div key={i} className="space-y-1.5">
                            <p className="text-xs text-gray-700 font-medium">{i + 1}. {qText}</p>
                            {qType === 'yes_no' && (
                              <div className="flex gap-1.5">
                                {['예', '아니오', '모르겠어요'].map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setFollowupAnswers(prev => ({ ...prev, [i]: option }))}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                                      followupAnswers[i] === option
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}
                            {qType === 'select' && qOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {qOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setFollowupAnswers(prev => ({ ...prev, [i]: option }))}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                                      followupAnswers[i] === option
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}
                            {qType === 'text' && (
                              <TextField
                                value={followupAnswers[i] || ''}
                                onChange={(e) => setFollowupAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                placeholder="답변을 입력하세요"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {answeredCount > 0 && (
                      <div className="space-y-1.5">
                        {/* 답변 안 한 질문이 있으면 안내 — 사용자가 빠진 질문을 의도적으로
                           스킵한 건지 확인할 기회. 빈 답변은 payload 에서 자동 제외됨. */}
                        {answeredCount < totalQ && (
                          <p className="text-[10px] text-gray-500 text-center">
                            답변하지 않은 {totalQ - answeredCount}개 질문은 분석에서 제외돼요
                          </p>
                        )}
                        <button
                          onClick={handleRefineAnalysis}
                          disabled={isRefining || refineExhausted}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed"
                        >
                          {isRefining ? (
                            <><Loader2 size={14} className="animate-spin" /> 재분석 중...</>
                          ) : refineExhausted ? (
                            <><Lock size={14} /> 오늘 재분석을 모두 사용했어요</>
                          ) : (
                            <><Stethoscope size={14} /> 답변 반영하여 재분석</>
                          )}
                        </button>
                        <p className="text-[10px] text-gray-400 text-center">
                          {answeredCount}/{totalQ} 답변
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* Upgrade banner — 응급 카드 아래(결과 하단)로 이동. 무료만 노출.
                    재분석 소진은 버튼 비활성화로 처리 → 별도 카드(중복 요금제 보기) 제거. */}
                {!isPaid && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl cursor-pointer" onClick={() => window.location.href = '/profile/subscription'}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown size={13} className="text-purple-500" />
                      <p className="text-xs font-bold text-gray-600">우리 아이 건강, 빈틈없이 케어하기</p>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      더 많은 검색 · 푸시 알림 · 분석 보관 · 기록장 확장
                    </p>
                  </div>
                )}

                {/* Disclaimer */}
                <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
                  AI 예측은 참고용이며, 정확한 진단은 수의사와 상담하세요.
                </p>
              </>
            )}
          </div>
        ) : !hasSearched ? (
          <div className="max-w-sm mx-auto mt-6">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">최근 검색어</h3>
            {recentSearches.length === 0 ? (
              <p className="text-xs text-gray-400">검색기록이 없습니다</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, idx) => (
                  <div key={idx} className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-gray-50 border border-gray-200 rounded-full">
                    <button onClick={() => clickSearchTerm(term)} className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                      {term}
                    </button>
                    <button onClick={() => deleteSearchTerm(term)} className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-10 text-center text-gray-300">
              <p className="text-sm">{searchMode === 'symptom' ? '증상을 입력하면 AI가 가능한 질병을 예측합니다' : '질병명이나 키워드로 관련 논문을 찾아보세요'}</p>
              <p className="text-xs mt-1">{searchMode === 'symptom' ? '' : 'AI가 수의학 논문을 분석하여 요약해드립니다'}</p>
            </div>
          </div>
        ) : searchMode === 'disease' ? (
          <div className="max-w-sm mx-auto space-y-5">
            {displayPubmed.step !== 'idle' && displayPubmed.step !== 'done' && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50">
                <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-500">{stepMessages[displayPubmed.step]}</p>
              </div>
            )}

            {/* Disease Description Card (#3) */}
            {desc && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">
                      {desc.name_ko}
                      {desc.name_en && <span className="text-xs text-gray-400 font-normal ml-1.5">({desc.name_en})</span>}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{desc.description}</p>
                  </div>
                </div>
                {desc.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {desc.symptoms.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white text-blue-600 rounded-full text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {desc.when_to_visit && (
                  <p className="text-[11px] text-orange-600 pl-6">
                    {desc.when_to_visit}
                  </p>
                )}
              </div>
            )}

            {/* Rate limit reached */}
            {displayPubmed.limitReached ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-gray-400" />
                </div>
                {(() => {
                  const lines = (displayPubmed.error || '').split('\n');
                  return (
                    <>
                      <p className="text-sm text-gray-600 font-medium">{lines[0]}</p>
                      {lines[1] && (
                        <p className="text-[11px] text-gray-400 mt-1">{lines[1]}</p>
                      )}
                    </>
                  );
                })()}
                {!isPaid && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Crown size={16} className="text-purple-500" />
                      <p className="text-sm font-bold text-gray-700">우리 아이 건강, 빈틈없이 케어하기</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">더 많은 검색 · 푸시 알림 · 분석 보관 · 기록장 확장</p>
                    <button
                      onClick={() => window.location.href = '/profile/subscription'}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium"
                    >
                      요금제 보기
                    </button>
                  </div>
                )}
              </div>
            ) : displayPubmed.error && displayPubmed.step === 'done' ? (
              <div className="text-center py-12">
                <AlertTriangle size={32} className="mx-auto mb-3 text-gray-300" />
                {(() => {
                  const lines = (displayPubmed.error || '').split('\n');
                  return (
                    <>
                      <p className="text-sm text-gray-500 font-medium">{lines[0]}</p>
                      {lines[1] && (
                        <p className="text-xs text-gray-400 mt-1">{lines[1]}</p>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <>
                {hasResults && !isPaid && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl cursor-pointer" onClick={() => window.location.href = '/profile/subscription'}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown size={13} className="text-purple-500" />
                      <p className="text-xs font-bold text-gray-600">우리 아이 건강, 빈틈없이 케어하기</p>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      더 많은 검색 · 푸시 알림 · 분석 보관 · 기록장 확장
                    </p>
                  </div>
                )}

                {aiFailed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs leading-relaxed flex-1">
                        <p className="font-medium text-amber-700">AI 분석을 불러오지 못했어요.</p>
                        <p className="text-amber-600 mt-0.5">검색 횟수는 차감되지 않았으니 재검색해주세요.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => displayPubmed.retry()}
                      className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      다시 검색하기
                    </button>
                  </div>
                )}

                <PaperSection
                  pubmed={displayPubmed}
                  diseaseName={searchTerm || ''}
                  diseaseSummary={mockResult?.summary || '관련 논문을 검색 중입니다...'}
                  bookmarkedPapers={bookmarkedPapers}
                  onToggleBookmark={toggleBookmark}
                  showBookmarks={isPaid && !saved && !aiFailed}
                />

                {/* AI Analysis sections — 실패 시엔 숨김 (유령 "분석 중" 메시지 방지) */}
                {!aiFailed && (
                <div>
                  <section>
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
                      <AlertTriangle size={14} className="text-orange-400" />
                      주의사항 & 대처방법
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      {displayPubmed.analysisLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                          <Loader2 size={14} className="animate-spin" />
                          AI가 논문을 분석하고 있습니다...
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {(displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0
                            ? displayPubmed.analysis.precautions
                            : mockResult?.precautions || ['검색 결과를 분석 중입니다...']
                          ).map((item, idx) => (
                            <li key={idx} className="flex gap-2 text-sm text-gray-600 items-start">
                              <span className="text-orange-300 mt-0.5 text-xs">●</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0 && (
                        <span className="inline-block text-[10px] bg-green-50 text-green-500 px-2 py-0.5 rounded-full mt-3">
                          논문 기반 AI 요약
                        </span>
                      )}
                    </div>
                  </section>

                  <section className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
                      <Pill size={14} className="text-purple-400" />
                      도움되는 성분
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      {displayPubmed.analysisLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                          <Loader2 size={14} className="animate-spin" />
                          성분 분석 중...
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0
                            ? displayPubmed.analysis.ingredients
                            : mockResult?.ingredients || ['분석 중...']
                          ).map((item, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      {displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0 && (
                        <span className="inline-block text-[10px] bg-green-50 text-green-500 px-2 py-0.5 rounded-full mt-3">
                          논문 기반 AI 요약
                        </span>
                      )}
                    </div>
                  </section>
                </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Sticky Bookmark Bar */}
      {showBottomBar && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 z-30">
          {saveError && (
            <p className="text-xs text-red-600 mb-2 text-center">{saveError}</p>
          )}
          {saveWarning && !saveError && (
            <p className="text-xs text-orange-500 mb-2 text-center">{saveWarning}</p>
          )}
          <button
            onClick={() => setShowSaveConfirm(true)}
            disabled={saving || saved}
            className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              saved
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Bookmark size={16} />
            {saved ? '보관 완료' : saving ? `보관 중...` : bookmarkedPapers.size > 0 ? `선택한 논문 보관하기 (${bookmarkedPapers.size}편)` : '이 분석 보관하기'}
          </button>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
            <h3 className="text-sm font-bold text-gray-800 mb-2">보관 확인</h3>
            <p className="text-sm text-gray-600 mb-1">
              {bookmarkedPapers.size > 0
                ? `선택한 논문 ${bookmarkedPapers.size}편과 분석 결과를 보관합니다.`
                : '분석 결과를 보관합니다.'}
            </p>
            <p className="text-xs text-gray-400 mb-4">보관한 내용은 마이페이지 &gt; 내 보관함에서 확인할 수 있습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { setShowSaveConfirm(false); handleSaveAnalysis(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                보관하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingScreen inMain />}>
      <SearchContent />
    </Suspense>
  );
}
