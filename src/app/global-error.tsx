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
            <h2 className="text-lg font-bold text-gray-900 mb-2">앗, 오류가 발생했어요!</h2>
            <p className="text-sm text-gray-500 mb-6">
              앱에 문제가 생겼어요. 다시 시도해주세요.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-blue-600 text-white rounded-full text-sm font-medium"
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
