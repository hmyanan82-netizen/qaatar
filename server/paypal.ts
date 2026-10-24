import { randomUUID } from "node:crypto";

export const PAYPAL_CURRENCY = "USD" as const;
export const QAR_PER_USD = 3.64;
export const VIP_PRICE_QAR = 55;

const PRODUCT_PRICES_QAR: Record<string, number> = {
  "CURVES 6172": 289,
  "CURVES 6153": 289,
  "Ann chery 5166": 318,
  "Curves 7811 high waist short": 191,
  "Ann chery 1024 Plus size": 172,
  "CURVES 6152": 210,
  "Curves 4000 Full Coverage back Bra": 74,
  "Ann chery 5147": 333,
  "Ann chery 5177": 368,
  "Ann Chery 5012L - Long short": 387,
  "CURVES 1503": 226,
  "Curves 1625": 162,
  "TIRAIN 3IN1 POSTPARTUM BELT": 147,
};

export type PaypalCartInput = {
  name: string;
  quantity: number;
  size: string;
  color?: string;
};

export type VerifiedPaypalCart = {
  items: Array<PaypalCartInput & { priceQar: number }>;
  subtotalQar: number;
  vipPriceQar: number;
  totalQar: number;
  amountUsdCents: number;
  amountUsd: string;
};

type PaypalErrorResponse = {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: Array<{ issue?: string; description?: string; field?: string }>;
};

type PaypalOrderResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
  payment_source?: {
    paypal?: unknown;
    apple_pay?: unknown;
    google_pay?: unknown;
    card?: { brand?: string; last_digits?: string };
  };
};

const PAYPAL_API_BASE = "https://api-m.paypal.com";
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function liveCredentials() {
  const clientId = process.env.PAYPAL_LIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_LIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("PayPal Live credentials are not configured");
  return { clientId, clientSecret };
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;

  const { clientId, clientSecret } = liveCredentials();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) throw new Error(`PayPal authentication failed (${response.status}: ${data.error ?? "unknown_error"})`);

  cachedAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 300) * 1000,
  };
  return cachedAccessToken.value;
}

async function paypalRequest(path: string, options: { method: "GET" | "POST"; body?: unknown; requestId?: string }) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.requestId ? { "PayPal-Request-Id": options.requestId } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json() as PaypalOrderResponse & PaypalErrorResponse;
  if (!response.ok) {
    const detail = data.details?.[0]?.description ?? data.message ?? data.name ?? "PayPal request failed";
    const field = data.details?.[0]?.field;
    throw new Error(`${detail}${field ? ` [${field}]` : ""} (${response.status}${data.debug_id ? `, ${data.debug_id}` : ""})`);
  }
  return data;
}

export function getPaypalLiveClientId() {
  return liveCredentials().clientId;
}

export async function generatePaypalClientToken() {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/identity/generate-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Accept-Language": "ar-QA",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json() as { client_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.client_token) {
    throw new Error(`PayPal client token failed (${response.status}: ${data.error_description ?? data.error ?? "unknown_error"})`);
  }
  return data.client_token;
}

export function verifyPaypalCart(items: PaypalCartInput[], vipIncluded: boolean): VerifiedPaypalCart {
  if (!items.length && !vipIncluded) throw new Error("Cart is empty");

  const verifiedItems = items.map(item => {
    const priceQar = PRODUCT_PRICES_QAR[item.name];
    if (!priceQar) throw new Error(`Unknown product: ${item.name}`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new Error("Invalid product quantity");
    return { ...item, priceQar };
  });

  const subtotalQar = verifiedItems.reduce((sum, item) => sum + item.priceQar * item.quantity, 0);
  const vipPriceQar = vipIncluded ? VIP_PRICE_QAR : 0;
  const totalQar = subtotalQar + vipPriceQar;
  const amountUsdCents = Math.round((totalQar * 100) / QAR_PER_USD);

  return {
    items: verifiedItems,
    subtotalQar,
    vipPriceQar,
    totalQar,
    amountUsdCents,
    amountUsd: (amountUsdCents / 100).toFixed(2),
  };
}

export function buildPaypalOrderPayload(input: {
  clientRequestId: string;
  cart: VerifiedPaypalCart;
}) {
  return {
    intent: "CAPTURE" as const,
    application_context: {
      brand_name: "Qatar Curves",
      landing_page: "BILLING" as const,
      shipping_preference: "NO_SHIPPING" as const,
      user_action: "PAY_NOW" as const,
    },
    purchase_units: [{
      reference_id: input.clientRequestId,
      custom_id: input.clientRequestId,
      description: "Qatar Curves order",
      amount: {
        currency_code: PAYPAL_CURRENCY,
        value: input.cart.amountUsd,
      },
    }],
  };
}

export async function createPaypalOrder(input: {
  clientRequestId: string;
  cart: VerifiedPaypalCart;
  customerName: string;
  zone: string;
  address?: string;
}) {
  const order = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    requestId: input.clientRequestId,
    body: buildPaypalOrderPayload(input),
  });

  if (!order.id) throw new Error("PayPal did not return an order ID");
  return { orderId: order.id, status: order.status, amountUsd: input.cart.amountUsd };
}

export async function capturePaypalOrder(paypalOrderId: string, clientRequestId: string) {
  const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    requestId: `${clientRequestId}-capture`.slice(0, 108),
  });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture?.id || capture.status !== "COMPLETED") throw new Error(`PayPal capture is not completed (${capture?.status ?? order.status})`);

  const paymentSource = order.payment_source?.apple_pay
    ? "apple_pay"
    : order.payment_source?.google_pay
      ? "google_pay"
      : order.payment_source?.card
        ? "card"
        : "paypal";

  return {
    orderId: order.id,
    captureId: capture.id,
    status: capture.status,
    paymentSource,
    cardBrand: order.payment_source?.card?.brand,
    cardLast4: order.payment_source?.card?.last_digits,
    currency: capture.amount?.currency_code,
    amount: capture.amount?.value,
  } as const;
}

export function newPaypalRequestId() {
  return `qc-${randomUUID()}`;
}
