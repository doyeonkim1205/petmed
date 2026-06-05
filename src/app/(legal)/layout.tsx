/**
 * 약관/정책 페이지 layout — 각 페이지가 자체 헤더 (LegalHeader) 를 렌더하므로
 * 여기서는 wrapper 만 담당. 헤더 + 콘텐츠 영역은 page 가 직접 구성.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {children}
    </div>
  );
}
