import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PawDex - 반려동물 건강 정보 플랫폼",
  description: "AI 증상 분석, 의학 논문 검색, 건강 기록장, 동물병원 찾기까지. 반려동물 건강을 스마트하게 관리하세요.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "PawDex - 반려동물 건강 정보 플랫폼",
    description: "AI 증상 분석, 의학 논문 검색, 건강 기록장, 동물병원 찾기까지. 반려동물 건강을 스마트하게 관리하세요.",
    url: "https://pawdex.store",
    siteName: "PawDex",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/icons/og-image.png",
        width: 1200,
        height: 630,
        alt: "PawDex - 반려동물 건강을 더 쉽게",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PawDex - 반려동물 건강 정보 플랫폼",
    description: "AI 증상 분석, 의학 논문 검색, 건강 기록장, 동물병원 찾기까지. 반려동물 건강을 스마트하게 관리하세요.",
    images: ["/icons/og-image.png"],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="only light" />
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('theme');
              var d = document.documentElement;
              var m = document.querySelector('meta[name="color-scheme"]');

              if (t === 'dark') {
                d.classList.add('dark');
                d.style.colorScheme = 'dark';
                if (m) m.setAttribute('content', 'dark');
              } else {
                d.classList.remove('dark');
                d.style.colorScheme = 'only light';
                if (m) m.setAttribute('content', 'only light');
              }

              var fs = parseInt(localStorage.getItem('fontSize'), 10);
              if (fs >= 12 && fs <= 24) d.style.fontSize = fs + 'px';

              var hc = localStorage.getItem('highContrast');
              if (hc === 'true') d.classList.add('high-contrast');
            } catch(e) {
              document.documentElement.style.colorScheme = 'only light';
            }
          })();
        ` }} />
      </head>
      <body className={`${geist.variable} antialiased bg-gray-50`}>
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
