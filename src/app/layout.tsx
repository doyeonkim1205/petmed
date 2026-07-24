import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { UpdateToast } from "@/components/UpdateToast";
import { KeyboardScrollFix } from "@/components/KeyboardScrollFix";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PawDex - 반려동물 건강기록",
  description: "초보 보호자도 쉽게 시작하는 반려동물 건강기록. AI 분석부터 기록·통계·알림·병원까지 한 곳에서!",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "PawDex - 반려동물 건강기록",
    description: "초보 보호자도 쉽게 시작하는 반려동물 건강기록. AI 분석부터 기록·통계·알림·병원까지 한 곳에서!",
    url: "https://pawdex.store",
    siteName: "PawDex",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/icons/og-image-v3.png",
        width: 1024,
        height: 500,
        alt: "PawDex - 우리 아이 건강 기록을 한눈에",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PawDex - 반려동물 건강기록",
    description: "초보 보호자도 쉽게 시작하는 반려동물 건강기록. AI 분석부터 기록·통계·알림·병원까지 한 곳에서!",
    images: ["/icons/og-image-v3.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
  // iPhone 홈 인디케이터 안전영역(env(safe-area-inset-*)) 활성화 → 하단 탭바가 바에 가리지 않음.
  // safe-area 인셋이 없는 웹/안드로이드는 0이라 영향 없음.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 쿠키 기반 locale (next-intl request 설정에서 결정) — <html lang> 동기화.
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (t === 'dark' || t === 'light') document.documentElement.classList.add(t);
            var fs = parseInt(localStorage.getItem('fontSize'), 10);
            if (fs >= 12 && fs <= 24) document.documentElement.style.fontSize = fs + 'px';
            var hc = localStorage.getItem('highContrast');
            if (hc !== 'false') document.documentElement.classList.add('high-contrast');
          } catch(e) {}
        ` }} />
      </head>
      <body className={`${geist.variable} antialiased bg-gray-50`}>
        {/* 상태바(안전영역) 파란 오버레이 — Android 16(API36) 엣지투엣지 강제로 네이티브
            statusBarColor 가 무시됨 → 웹에서 상태바 자리를 파란색으로 칠한다.
            env(safe-area-inset-top)=0 인 일반 웹/비노치 기기에선 높이 0 → 안 보임(무영향). */}
        <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'env(safe-area-inset-top)', backgroundColor: '#2563EB', zIndex: 2147483646, pointerEvents: 'none' }} />
        <NextIntlClientProvider>
          <NetworkStatusBanner />
          <Providers>
            {children}
          </Providers>
          {/* UpdateToast 는 useTranslations 사용 → 반드시 Provider 안에 둬야 함.
              (ServiceWorkerRegister/KeyboardScrollFix 는 intl 미사용이나 함께 안에 둠) */}
          <ServiceWorkerRegister />
          <UpdateToast />
          <KeyboardScrollFix />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
