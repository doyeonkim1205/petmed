import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PetMed - 반려동물 건강 정보 플랫폼",
  description: "반려동물 질병 정보, 건강 기록장, 동물병원 찾기",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
            if (t === 'dark') document.documentElement.classList.add('dark');
            var fs = localStorage.getItem('fontSize');
            if (fs) document.documentElement.style.fontSize = fs + 'px';
            var hc = localStorage.getItem('highContrast');
            if (hc === 'true') document.documentElement.classList.add('high-contrast');
          } catch(e) {}
        ` }} />
      </head>
      <body className={`${geist.variable} antialiased bg-gray-50`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
