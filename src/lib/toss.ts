// Widget secret key — used for confirming/canceling 1회성(widget) payments.
const TOSS_SECRET_KEY = process.env.TOSS_WIDGET_SECRET_KEY!;
const TOSS_API_URL = 'https://api.tosspayments.com/v1';

function getAuthHeader() {
  const encoded = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
}

export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const res = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '결제 승인에 실패했습니다.');
  }
  return data;
}

export async function cancelPayment(paymentKey: string, cancelReason: string) {
  const res = await fetch(`${TOSS_API_URL}/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancelReason }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '결제 취소에 실패했습니다.');
  }
  return data;
}
