import type { Metadata } from 'next';

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
const APPSTORE_URL = 'https://apps.apple.com/kr/iphone/search?term=pawdex';
const INSTAGRAM_URL = 'https://www.instagram.com/pawdex_?igsh=Mm5lZzZnZHA5b3Vj';
const THREADS_URL = 'https://www.threads.com/@pawdex_';

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  );
}

function ThreadsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
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

function AppleIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.536c-.026-2.617 2.137-3.872 2.234-3.934-1.216-1.78-3.106-2.024-3.78-2.05-1.61-.163-3.142.948-3.957.948-.814 0-2.075-.924-3.41-.899-1.755.026-3.375 1.02-4.28 2.59-1.824 3.165-.467 7.852 1.31 10.42.866 1.257 1.899 2.668 3.253 2.618 1.304-.052 1.798-.845 3.375-.845 1.577 0 2.02.845 3.401.82 1.404-.026 2.293-1.281 3.153-2.543.993-1.46 1.402-2.872 1.427-2.945-.031-.014-2.74-1.052-2.766-4.173-.026-2.611 2.13-3.863 2.228-3.93m-2.6-7.227c.72-.873 1.205-2.087 1.073-3.295-1.036.042-2.292.69-3.036 1.562-.667.774-1.251 2.01-1.094 3.196 1.157.09 2.337-.587 3.057-1.463" />
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
        <h1 className="mt-6 text-[30px] font-extrabold tracking-tight text-[#1e2a45]">PawDex</h1>
        <p className="mt-3 text-[14px] font-normal leading-relaxed tracking-tight text-[#5a6478]">
          오늘의 작은 기록이
          <br />
          내일의 우리 아이를 이해하는
          <br />
          힌트가 될 수 있도록
        </p>

        {/* 버튼 (가로 나란히) */}
        <div className="mt-8 flex w-full items-center gap-2.5">
          <a
            href={PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 text-[#16213a] shadow-sm shadow-gray-200/60 transition active:scale-[0.98]"
          >
            <GooglePlayIcon size={24} />
            <span className="text-left leading-tight">
              <span className="block text-[9px] font-semibold tracking-[0.04em] text-[#8b93a3]">Android</span>
              <span className="block text-[14px] font-extrabold">Google Play</span>
            </span>
          </a>

          {/* App Store 버튼 (URL 발급 전: placeholder) */}
          <a
            href={APPSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={APPSTORE_URL === '#'}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 text-[#16213a] shadow-sm shadow-gray-200/60 transition active:scale-[0.98]"
          >
            <AppleIcon size={28} />
            <span className="text-left leading-tight">
              <span className="block text-[9px] font-semibold tracking-[0.04em] text-[#8b93a3]">iOS</span>
              <span className="block text-[14px] font-extrabold">App Store</span>
            </span>
          </a>
        </div>
        {/* 소셜 */}
        <div className="mt-10 flex items-center gap-4">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1e2a45] shadow-md ring-1 ring-gray-100 transition hover:text-pink-500 active:scale-95"
          >
            <InstagramIcon size={22} />
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
