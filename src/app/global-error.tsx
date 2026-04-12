'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="bg-white">
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/error-illustration.svg"
              alt="에러 일러스트"
              width={200}
              height={200}
              className="mx-auto mb-4"
            />
            <h2 className="text-base font-bold text-gray-900 mb-2">앗, 문제가 발생했어요!</h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              일시적인 오류일 수 있어요.<br />
              잠시 후 다시 시도해주세요.<br />
              문제가 계속되면 앱을 재실행해주세요.
            </p>
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-medium"
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
