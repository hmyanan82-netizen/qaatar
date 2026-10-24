import { describe, expect, it } from "vitest";
import {
  beginPaypalRequest,
  clearPaypalRequest,
  PAYPAL_REQUEST_KEY,
  readPaypalRequest,
  type PaypalRequestStorage,
} from "../client/src/lib/paypalRequest";

function memoryStorage(initial?: Record<string, string>): PaypalRequestStorage {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe("PayPal request lifecycle", () => {
  it("creates a fresh id for every new payment attempt", () => {
    const storage = memoryStorage({ [PAYPAL_REQUEST_KEY]: "qc-00000000-0000-4000-8000-000000000000" });
    const first = beginPaypalRequest(storage);
    const second = beginPaypalRequest(storage);

    expect(first).toMatch(/^qc-[0-9a-f-]{36}$/i);
    expect(second).toMatch(/^qc-[0-9a-f-]{36}$/i);
    expect(second).not.toBe(first);
    expect(readPaypalRequest(storage)).toBe(second);
  });

  it("rejects stale or malformed request ids", () => {
    const storage = memoryStorage({ [PAYPAL_REQUEST_KEY]: "old-expired-order" });
    expect(readPaypalRequest(storage)).toBeNull();
  });

  it("clears the active request after success, cancellation, or failure", () => {
    const storage = memoryStorage();
    beginPaypalRequest(storage);
    clearPaypalRequest(storage);
    expect(readPaypalRequest(storage)).toBeNull();
  });
});
