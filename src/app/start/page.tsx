import type { Metadata } from 'next';
import { Instagram } from 'lucide-react';

/**
 * 인스타 바이오용 공개 랜딩 (pawdex.store/start) — 링크-인-바이오 스타일.
 * (main) 인증 그룹 밖 최상위 라우트라 로그인 없이 접근 (OnboardingGate 도 화이트리스트).
 * 짧게: 문구 + Google Play 버튼 + 인스타/스레드 링크.
 */
export const metadata: Metadata = {
  title: 'PawDex — 우리 아이 건강 기록을 한눈에',
  description:
    '진료·증상·일상 기록부터 AI 분석·통계·알림까지. 흩어진 우리 아이 건강을 PawDex 하나로. Google Play에서 무료로 시작하세요.',
  alternates: { canonical: 'https://pawdex.store/start' },
  robots: { index: true, follow: true },
};

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.dylabs.pawdex&referrer=utm_source%3Dinstagram%26utm_medium%3Dbio';
const INSTAGRAM_URL = 'https://www.instagram.com/pawdex_?igsh=Mm5lZzZnZHA5b3Vj';
const THREADS_URL = 'https://www.threads.com/@pawdex_';

function ThreadsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.291 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.36-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.85 13.85 0 0 1 3.02.142c-.126-.742-.375-1.332-.747-1.759-.513-.587-1.308-.887-2.359-.895h-.034c-.844 0-1.992.232-2.721 1.32L7.9 7.012c.98-1.461 2.568-2.266 4.478-2.266h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.504-11.158c-.183 0-.368.006-.555.018-1.66.094-2.563 1.02-2.49 2.357.05 1.05.728 1.504 1.727 1.45 2.19-.118 3.323-1.238 3.516-3.65-.518-.114-1.089-.173-1.7-.173z" />
    </svg>
  );
}

export default function StartPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e9f1ff] via-[#f4f8ff] to-white px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* 브랜드 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512x512.png" alt="PawDex" className="h-24 w-24 rounded-[22%] shadow-lg" />
        <h1 className="mt-6 text-[26px] font-extrabold tracking-tight text-[#1e2a45]">PawDex</h1>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#5a6478]">
          우리 아이 건강 기록을 한눈에.
          <br />
          진료·증상·AI 분석·통계·알림까지 하나로.
        </p>

        {/* 버튼 */}
        <a
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-9 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#16213a] px-7 py-4 text-white shadow-lg shadow-blue-900/15 transition active:scale-[0.98]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M3 3l16.5 9L3 21V3z" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-[11px] opacity-70">GET IT ON</span>
            <span className="block text-[17px] font-extrabold">Google Play</span>
          </span>
        </a>
        <a href="/" className="mt-3 text-[13px] font-semibold text-blue-500 underline-offset-2 hover:underline">
          아이폰·PC는 웹에서 바로 시작 →
        </a>

        {/* 소셜 */}
        <div className="mt-9 flex items-center gap-4">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1e2a45] shadow-md ring-1 ring-gray-100 transition hover:text-pink-500 active:scale-95"
          >
            <Instagram size={22} />
          </a>
          <a
            href={THREADS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Threads"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1e2a45] shadow-md ring-1 ring-gray-100 transition hover:text-black active:scale-95"
          >
            <ThreadsIcon size={22} />
          </a>
        </div>

        {/* 푸터 */}
        <p className="mt-10 text-[11px] leading-relaxed text-gray-400">
          * AI 분석은 참고용이며, 수의사의 진단을 대신하지 않아요.
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
          <a href="/terms" className="hover:text-gray-600">이용약관</a>
          <span className="text-gray-300">·</span>
          <a href="/privacy" className="hover:text-gray-600">개인정보처리방침</a>
          <span className="text-gray-300">·</span>
          <a href="/business" className="hover:text-gray-600">사업자정보</a>
        </div>
      </div>
    </main>
  );
}
