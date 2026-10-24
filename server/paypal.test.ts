import { describe, expect, it } from "vitest";
import { buildPaypalOrderPayload, QAR_PER_USD, verifyPaypalCart } from "./paypal";

describe("PayPal server-side cart pricing", () => {
  it("calculates the discounted catalog price and USD charge on the server", () => {
    const cart = verifyPaypalCart([{ name: "CURVES 6172", quantity: 2, size: "M", color: "Black" }], false);
    expect(cart.subtotalQar).toBe(578);
    expect(cart.totalQar).toBe(578);
    expect(cart.amountUsdCents).toBe(Math.round((578 * 100) / QAR_PER_USD));
  });

  it("adds the fixed VIP service price only when selected", () => {
    const cart = verifyPaypalCart([], true);
    expect(cart.vipPriceQar).toBe(55);
    expect(cart.totalQar).toBe(55);
  });

  it("charges the updated CURVES 6152 price of 210 QAR", () => {
    const cart = verifyPaypalCart([{ name: "CURVES 6152", quantity: 1, size: "M", color: "Beige" }], false);
    expect(cart.subtotalQar).toBe(210);
    expect(cart.totalQar).toBe(210);
    expect(cart.amountUsdCents).toBe(Math.round((210 * 100) / QAR_PER_USD));
  });

  it("rejects unknown products instead of trusting browser prices", () => {
    expect(() => verifyPaypalCart([{ name: "FAKE PRODUCT", quantity: 1, size: "M" }], false)).toThrow("Unknown product");
  });

  it("configures guest checkout without sending a duplicate shipping address", () => {
    const cart = verifyPaypalCart([{ name: "CURVES 6172", quantity: 1, size: "M" }], false);
    const payload = buildPaypalOrderPayload({ clientRequestId: "qc-guest-checkout-test", cart });

    expect(payload.application_context).toEqual({
      brand_name: "Qatar Curves",
      landing_page: "BILLING",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    });
    expect(payload.purchase_units[0]).not.toHaveProperty("shipping");
    expect(payload.purchase_units[0].amount).toEqual({ currency_code: "USD", value: cart.amountUsd });
  });
});
