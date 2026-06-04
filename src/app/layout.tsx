import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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
  title: "PawDex - 쉬운 반려동물 건강기록장",
  description: "초보 보호자도 쉽게 시작하는 반려동물 건강 기록. AI 분석부터 진료, 일상, 체중, 의료비 관리를 한 곳에서.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "PawDex - 쉬운 반려동물 건강기록장",
    description: "초보 보호자도 쉽게 시작하는 반려동물 건강 기록. AI 분석부터 진료, 일상, 체중, 의료비 관리를 한 곳에서.",
    url: "https://pawdex.store",
    siteName: "PawDex",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/icons/og-image-v2.png",
        width: 1200,
        height: 630,
        alt: "PawDex - 반려동물 건강을 더 쉽게",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PawDex - 쉬운 반려동물 건강기록장",
    description: "초보 보호자도 쉽게 시작하는 반려동물 건강 기록. AI 분석부터 진료, 일상, 체중, 의료비 관리를 한 곳에서.",
    images: ["/icons/og-image-v2.png"],
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
        <NetworkStatusBanner />
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegister />
        <UpdateToast />
        <KeyboardScrollFix />
      </body>
    </html>
  );
}
