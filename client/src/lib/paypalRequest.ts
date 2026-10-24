export const PAYPAL_REQUEST_KEY = "qatar-curves-paypal-request-id";

export type PaypalRequestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function beginPaypalRequest(storage: PaypalRequestStorage) {
  const requestId = `qc-${crypto.randomUUID()}`;
  storage.setItem(PAYPAL_REQUEST_KEY, requestId);
  return requestId;
}

export function readPaypalRequest(storage: PaypalRequestStorage) {
  const requestId = storage.getItem(PAYPAL_REQUEST_KEY);
  return requestId && /^qc-[0-9a-f-]{36}$/i.test(requestId) ? requestId : null;
}

export function clearPaypalRequest(storage: PaypalRequestStorage) {
  storage.removeItem(PAYPAL_REQUEST_KEY);
}
