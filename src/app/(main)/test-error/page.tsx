'use client';

// 에러 페이지(error.tsx) 테스트용 — 접속 시 즉시 에러 발생
// 확인 후 삭제 가능
export default function TestErrorPage() {
  throw new Error('Test error for error.tsx verification');
}
