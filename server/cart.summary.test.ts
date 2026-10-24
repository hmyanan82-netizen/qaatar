import { describe, expect, it } from "vitest";
import { cartQuickSummary, type CartState } from "../client/src/lib/cart";

const cart: CartState = {
  items: [
    {
      id: "curves-6172-m",
      name: "CURVES 6172",
      image: "/curves-6172.jpg",
      priceQar: 289,
      originalPriceQar: 723,
      salePercent: 60,
      size: "M",
      age: 30,
      color: "Beige",
      quantity: 2,
    },
    {
      id: "curves-4000-l",
      name: "Curves 4000 Full Coverage back Bra",
      image: "/curves-4000.jpg",
      priceQar: 74,
      originalPriceQar: 184,
      salePercent: 60,
      size: "L",
      age: 30,
      color: "Black",
      quantity: 1,
    },
  ],
  vip: {
    name: "خدمة VIP",
    priceQar: 55,
    date: "2026-09-30",
    time: "18:00",
    zone: "الدوحة",
  },
};

describe("cartQuickSummary", () => {
  it("counts product quantities and includes the VIP service in the total", () => {
    expect(cartQuickSummary(cart)).toEqual({
      itemCount: 3,
      productLines: [
        { name: "CURVES 6172", quantity: 2 },
        { name: "Curves 4000 Full Coverage back Bra", quantity: 1 },
      ],
      vipIncluded: true,
      totalQar: 707,
    });
  });

  it("keeps an empty product count for a VIP-only checkout", () => {
    expect(cartQuickSummary({ items: [], vip: cart.vip })).toMatchObject({
      itemCount: 0,
      vipIncluded: true,
      totalQar: 55,
    });
  });
});
