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

function GooglePlayIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 283) / 256} viewBox="0 0 256 283" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#EA4335" d="M119.553141 134.916362 1.0599006 259.060547c2.69629388 9.556451 9.6583830 17.330053 18.8609652 21.05943 9.2025823 3.729376 19.6122577 2.995739 28.2008062-1.987493L181.448642 202.197919z" />
      <path fill="#FBBC04" d="M239.370822 113.813616 181.71353 80.7909097l-64.897565 56.9509243 65.162453 64.279492 57.215812-32.669522c10.331493-5.409352 16.80572-16.107154 16.80572-27.769094 0-11.66194-6.474227-22.359742-16.80572-27.7690944z" />
      <path fill="#4285F4" d="M1.0599006 23.4868015C.343633396 26.134699-.012753882 28.8670014 0 31.6100341V250.937314c.00751268 2.741728.363556675 5.471398 1.0599006 8.123233L123.614758 138.095018z" />
      <path fill="#34A853" d="M120.436101 141.273674 181.71353 80.7909097 48.5631521 4.50316009C43.5539929 1.56944036 37.8568091.015662967 32.0517989 0 17.6444261-.028487328 4.97836875 9.53420553 1.0599006 23.3985055z" />
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
          AI 분석·통계·알림·지출까지.
        </p>

        {/* 버튼 */}
        <a
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-9 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#16213a] px-7 py-4 text-white shadow-lg shadow-blue-900/15 transition active:scale-[0.98]"
        >
          <GooglePlayIcon size={28} />
          <span className="text-left leading-tight">
            <span className="block text-[11px] font-semibold tracking-[0.04em] opacity-70">Android</span>
            <span className="block text-[17px] font-extrabold">Google Play</span>
          </span>
        </a>
        {/* 소셜 */}
        <div className="mt-10 flex items-center gap-4">
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
      </div>
    </main>
  );
}
