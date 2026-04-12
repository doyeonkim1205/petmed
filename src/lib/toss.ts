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
