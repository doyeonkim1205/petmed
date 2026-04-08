// Toss Payments billing (recurring) API client.
// Reference: https://docs.tosspayments.com/reference#%EB%B9%8C%EB%A7%81

const BILLING_SECRET = process.env.TOSS_BILLING_SECRET_KEY!;
const TOSS_API_URL = 'https://api.tosspayments.com/v1';

function authHeader(): string {
  // Toss expects Basic base64(secretKey + ":")
  const encoded = Buffer.from(`${BILLING_SECRET}:`).toString('base64');
  return `Basic ${encoded}`;
}

export interface TossBillingError extends Error {
  code?: string;
  status?: number;
  raw?: unknown;
}

function makeError(message: string, code?: string, status?: number, raw?: unknown): TossBillingError {
  const e = new Error(message) as TossBillingError;
  e.code = code;
  e.status = status;
  e.raw = raw;
  return e;
}

export interface TossCardInfo {
  issuerCode?: string;
  acquirerCode?: string;
  number?: string; // masked, e.g. "433012******1234"
  cardType?: string;
  ownerType?: string;
}

export interface IssuedBilling {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  cardCompany?: string;
  cardNumber?: string;
  card?: TossCardInfo;
}

/**
 * Exchange a one-time authKey (from the browser flow) for a permanent billingKey.
 * Call this from the server after the user completes card registration on Toss.
 */
export async function issueBillingKey(authKey: string, customerKey: string): Promise<IssuedBilling> {
  const res = await fetch(`${TOSS_API_URL}/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw makeError(
      data?.message || '빌링키 발급에 실패했습니다.',
      data?.code,
      res.status,
      data,
    );
  }
  return data as IssuedBilling;
}

export interface BillingChargeInput {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  taxFreeAmount?: number;
}

export interface BillingChargeResult {
  mId: string;
  paymentKey: string;
  orderId: string;
  status: string; // "DONE", "CANCELED", "ABORTED", ...
  totalAmount: number;
  approvedAt?: string;
  receipt?: { url: string };
  card?: TossCardInfo;
}

/**
 * Charge an existing billingKey. Used by the auto-billing cron and the
 * initial first charge right after issuing the billing key.
 */
export async function chargeBilling(input: BillingChargeInput): Promise<BillingChargeResult> {
  const { billingKey, ...body } = input;
  const res = await fetch(`${TOSS_API_URL}/billing/${encodeURIComponent(billingKey)}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw makeError(
      data?.message || '자동 결제에 실패했습니다.',
      data?.code,
      res.status,
      data,
    );
  }
  return data as BillingChargeResult;
}

/**
 * Map a Toss billing error code to a user-friendly Korean message and a
 * "should retry" hint. Used by the auto-billing cron and notifications.
 */
export function classifyBillingError(code?: string): {
  userMessage: string;
  retryable: boolean;
} {
  switch (code) {
    case 'EXCEED_MAX_CARD_INSTALLMENT_PLAN':
    case 'INVALID_CARD_INSTALLMENT_PLAN':
      return { userMessage: '카드 할부가 지원되지 않습니다.', retryable: false };
    case 'NOT_AVAILABLE_BANK':
    case 'INVALID_CARD_LOST_OR_STOLEN':
      return { userMessage: '카드가 분실/도난 등록되어 있습니다.', retryable: false };
    case 'INVALID_CARD_EXPIRATION':
      return { userMessage: '카드 유효기간이 만료되었습니다.', retryable: false };
    case 'INVALID_CARD_NUMBER':
      return { userMessage: '카드 번호 정보가 올바르지 않습니다.', retryable: false };
    case 'EXCEED_MAX_PAYMENT_AMOUNT':
    case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
    case 'EXCEED_MAX_ONE_DAY_AMOUNT':
      return { userMessage: '카드 한도를 초과했습니다.', retryable: true };
    case 'NOT_ENOUGH_BALANCE':
    case 'INSUFFICIENT_BALANCE':
      return { userMessage: '카드 잔액이 부족합니다.', retryable: true };
    case 'INVALID_STOPPED_CARD':
    case 'STOPPED_CARD':
      return { userMessage: '정지된 카드입니다.', retryable: false };
    case 'REJECT_CARD_COMPANY':
      return { userMessage: '카드사에서 결제를 거절했습니다.', retryable: true };
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return { userMessage: '일시적인 통신 장애가 발생했습니다.', retryable: true };
    default:
      return { userMessage: '결제에 실패했습니다.', retryable: true };
  }
}
