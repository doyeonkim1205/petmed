const TOSS_API_URL = 'https://api.tosspayments.com/v1';

// Widget secret key — for confirming/canceling widget (link) payments
const WIDGET_SECRET = process.env.TOSS_WIDGET_SECRET_KEY!;
// Billing secret key — for confirming/canceling billing (bill) payments
const BILLING_SECRET = process.env.TOSS_BILLING_SECRET_KEY!;

function makeAuth(secret: string): string {
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
}

export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const res = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: 'POST',
    headers: { Authorization: makeAuth(WIDGET_SECRET), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '결제 승인에 실패했습니다.');
  return data;
}

export async function cancelPayment(paymentKey: string, cancelReason: string, useBillingKey = false) {
  const secret = useBillingKey ? BILLING_SECRET : WIDGET_SECRET;
  const res = await fetch(`${TOSS_API_URL}/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: { Authorization: makeAuth(secret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancelReason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '결제 취소에 실패했습니다.');
  return data;
}

/**
 * cancelPayment 의 키-자동선택 버전.
 *
 * 결제 취소는 paymentKey 를 발급한 키(위젯 vs 빌링)와 cancel 호출 키가 일치해야 한다.
 * 그런데 호출부는 "결제건이 어떤 키로 승인됐는지" 정보가 없고 "구독의 현재 billing_type"
 * 으로만 추정한다. 사용자가 one_time ↔ recurring 전환 이력이 있으면 과거 결제건과
 * 현재 billing_type 이 달라 키 불일치로 cancel 이 실패할 수 있다.
 *
 * → preferBillingKey 로 1차 시도, 실패 시 반대 키로 1회 재시도. 둘 다 실패하면
 *   첫 에러를 surface (보통 더 정확). cancel 은 토스에서 멱등 처리되므로 중복취소 위험 없음.
 */
export async function cancelPaymentAutoKey(paymentKey: string, cancelReason: string, preferBillingKey: boolean) {
  try {
    return await cancelPayment(paymentKey, cancelReason, preferBillingKey);
  } catch (firstErr) {
    try {
      return await cancelPayment(paymentKey, cancelReason, !preferBillingKey);
    } catch {
      throw firstErr;
    }
  }
}
