import { describe, expect, it } from "vitest";
import { cartTotal, discountedPrice, normalizeCartItemPricing, SALE_PERCENT, type CartState } from "../client/src/lib/cart";

describe("Qatar Curves 60% sale pricing", () => {
  it("calculates the advertised discount using rounded QAR prices", () => {
    expect(SALE_PERCENT).toBe(60);
    expect(discountedPrice(723)).toBe(289);
    expect(discountedPrice(478)).toBe(191);
  });

  it("uses discounted item prices in the cart total", () => {
    const cart: CartState = {
      items: [{
        id: "curves-6172-M",
        name: "CURVES 6172",
        image: "",
        originalPriceQar: 723,
        priceQar: 289,
        salePercent: 60,
        size: "M",
        age: 30,
        color: "Black",
        quantity: 2,
      }],
    };
    expect(cartTotal(cart)).toBe(578);
  });

  it("migrates an older CURVES 6152 cart entry to the new 210 QAR price", () => {
    const item = normalizeCartItemPricing({
      id: "curves-6152-M-Beige",
      name: "CURVES 6152",
      image: "",
      originalPriceQar: 723,
      priceQar: 289,
      salePercent: 60,
      size: "M",
      age: 30,
      color: "Beige",
      quantity: 1,
    });

    expect(item.originalPriceQar).toBe(525);
    expect(item.priceQar).toBe(210);
  });
});
