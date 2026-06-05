import { notFound } from 'next/navigation';
import PaymentReviewClient from './PaymentReviewClient';

/**
 * 토스페이먼츠 심사용 히든 페이지 (단기/연간 결제 시연).
 *
 * 일반 사용자에게는 노출되지 않음:
 *   - Footer/메뉴 link 없음
 *   - robots.txt 차단 (/payment-review)
 *   - 환경변수 ENABLE_PAYMENT_REVIEW !== 'true' 면 404
 *
 * 결제 흐름:
 *   - TEST 토스 키 사용 (실제 결제 X)
 *   - successUrl/failUrl 은 /payment-review/success(fail) 로 분기
 *   - confirm API 호출 X → DB plan 변경 X → 일반 사용자 영향 0
 *
 * 심사 통과 후 정리:
 *   1. Vercel 환경변수 ENABLE_PAYMENT_REVIEW=false → 즉시 404
 *   2. (안정 후) src/app/payment-review/ 폴더 통째 삭제
 */
export default function PaymentReviewPage() {
  if (process.env.ENABLE_PAYMENT_REVIEW !== 'true') {
    notFound();
  }
  return <PaymentReviewClient />;
}
