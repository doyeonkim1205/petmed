import type { Metadata } from 'next';
import { ClipboardList, Sparkles, BarChart3, Bell, FileSearch } from 'lucide-react';

/**
 * 인스타 바이오용 공개 랜딩 (pawdex.store/start).
 * (main) 그룹 밖 최상위 라우트라 인증 가드 없이 누구나 접근 가능.
 * 안드로이드는 Google Play, 아이폰·PC는 웹(PWA)로 안내.
 */
export const metadata: Metadata = {
  title: 'PawDex 시작하기 — 우리 아이 건강 기록을 한눈에',
  description:
    '진료·증상·일상 기록부터 AI 분석·통계·알림까지. 흩어진 우리 아이 건강을 PawDex 하나로. Google Play에서 무료로 시작하세요.',
  alternates: { canonical: 'https://pawdex.store/start' },
  robots: { index: true, follow: true },
};

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.dylabs.pawdex&referrer=utm_source%3Dinstagram%26utm_medium%3Dbio';

const FEATURES = [
  { icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50', title: '기록을 한 곳에', desc: '진료·증상·일상·입퇴원을 사진·PDF까지 함께' },
  { icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50', title: 'AI 케어', desc: '증상·사진을 읽고 관찰 포인트를 정리' },
  { icon: FileSearch, color: 'text-blue-600', bg: 'bg-blue-50', title: '논문 검색', desc: '궁금한 질병은 수의학 논문까지 쉽게' },
  { icon: Bell, color: 'text-pink-600', bg: 'bg-pink-50', title: '복약·예방 알림', desc: '약 먹이는 시간·예방접종 일정 챙기기' },
  { icon: BarChart3, color: 'text-cyan-700', bg: 'bg-cyan-50', title: '통계·지출', desc: '체중·식사·음수부터 병원비까지 그래프로' },
];

function PlayButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-3 rounded-2xl bg-[#16213a] px-7 py-4 text-white shadow-lg shadow-blue-900/15 transition active:scale-[0.98] ${className}`}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden>
        <path d="M3 3l16.5 9L3 21V3z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[11px] opacity-70">GET IT ON</span>
        <span className="block text-lg font-extrabold">Google Play</span>
      </span>
    </a>
  );
}

export default function StartPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e9f1ff] via-[#f4f8ff] to-white">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-16 pt-14 text-center">
        {/* 브랜드 */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512x512.png" alt="PawDex" className="h-16 w-16 rounded-[22%] shadow-md" />
          <span className="text-3xl font-extrabold tracking-tight text-[#1e2a45]">PawDex</span>
        </div>

        {/* 헤드라인 */}
        <h1 className="mt-8 text-[34px] font-extrabold leading-[1.25] tracking-tight text-[#16213a]">
          우리 아이 건강 기록을
          <br />
          <span className="text-blue-600">한눈에.</span>
        </h1>
        <p className="mt-4 text-[15px] font-medium leading-relaxed text-[#5a6478]">
          진료·증상·일상 기록부터 AI 분석·통계·알림까지,
          <br />
          흩어진 우리 아이 건강을 PawDex 하나로.
        </p>

        {/* CTA */}
        <PlayButton className="mt-8" />
        <p className="mt-3 text-[12px] text-gray-400">안드로이드에서 무료로 시작하세요</p>

        {/* 폰 스크린샷 */}
        <div className="mt-10 w-[260px] rounded-[34px] border-[6px] border-[#15171c] bg-[#15171c] shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/home.jpg" alt="PawDex 홈 화면" className="block w-full rounded-[28px]" />
        </div>

        {/* 기능 */}
        <div className="mt-12 w-full space-y-3 text-left">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${f.bg}`}>
                  <Icon size={22} className={f.color} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-800">{f.title}</p>
                  <p className="mt-0.5 text-[13px] text-gray-500">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 마지막 CTA */}
        <div className="mt-12 w-full rounded-3xl bg-blue-600 px-7 py-9 text-white">
          <p className="text-xl font-extrabold leading-snug">이제 따로 찾지 말고,
            <br />PawDex에서 🐾</p>
          <PlayButton className="mt-6 bg-white !text-[#16213a] [&_span]:!text-[#16213a]" />
        </div>

        {/* 푸터 */}
        <div className="mt-10 space-y-3 text-[12px] text-gray-400">
          <p>
            아이폰·PC에서는 웹에서 바로 이용{' '}
            <a href="/" className="font-semibold text-blue-500 underline-offset-2 hover:underline">pawdex.store</a>
          </p>
          <p className="text-gray-300">* AI 분석은 참고용이며, 수의사의 진단을 대신하지 않아요.</p>
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <a href="/terms" className="hover:text-gray-600">이용약관</a>
            <span className="text-gray-200">·</span>
            <a href="/privacy" className="hover:text-gray-600">개인정보처리방침</a>
            <span className="text-gray-200">·</span>
            <a href="/business" className="hover:text-gray-600">사업자정보</a>
          </div>
          <p className="pt-2 text-gray-300">© PawDex</p>
        </div>
      </div>
    </main>
  );
}
