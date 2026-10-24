import { describe, expect, it } from "vitest";
import { appRouter, checkoutStageInput, paypalCheckoutInput, safeOrderInput, sandboxPaymentInput } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: role === "admin" ? "owner" : "customer",
      name: "Qatar Curves",
      email: "owner@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.dashboard", () => {
  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin users to access the dashboard contract", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    const result = await caller.admin.dashboard();
    expect(result).toHaveProperty("visitors");
    expect(result).toHaveProperty("recentVisitors");
    expect(result).toHaveProperty("recentRegistrations");
    expect(result).toHaveProperty("recentOrders");
    expect(result).toHaveProperty("recentSandboxPayments");
    expect(result).toHaveProperty("recentPaypalPayments");
    for (const order of result.recentOrders) {
      expect(order).not.toHaveProperty("cardNumber");
      expect(order).not.toHaveProperty("cvv");
      expect(order).not.toHaveProperty("otp");
    }
    for (const payment of result.recentPaypalPayments) {
      expect(payment).not.toHaveProperty("cardNumber");
      expect(payment).not.toHaveProperty("cvv");
      expect(payment).not.toHaveProperty("otp");
    }
    for (const visitor of result.recentVisitors) {
      expect(visitor).toHaveProperty("currentPath");
      expect(visitor).not.toHaveProperty("userAgent");
      expect(visitor).not.toHaveProperty("sessionKey");
    }
  }, 15_000);

  it("accepts only safe payment references for dashboard orders", () => {
    const parsed = safeOrderInput.parse({
      clientRequestId: "order-request-123456",
      customerName: "عميل اختبار",
      phone: "+97455550000",
      zone: "الدوحة",
      address: "عنوان اختبار",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M", color: "Black", priceQar: 100 }],
      vipPriceQar: 0,
      cardBrand: "visa",
      cardLast4: "4242",
    });
    expect(parsed.cardLast4).toBe("4242");
    expect(parsed.clientRequestId).toBe("order-request-123456");
  });

  it("rejects full card, CVV, and OTP fields", () => {
    expect(() => safeOrderInput.parse({
      customerName: "عميل اختبار",
      phone: "+97455550000",
      zone: "الدوحة",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M", priceQar: 100 }],
      cardBrand: "visa",
      cardLast4: "4242",
      cardNumber: "4242424242424242",
      cvv: "123",
      otp: "123456",
    })).toThrow();
  });

  it("accepts PayPal checkout metadata without client-controlled prices", () => {
    const parsed = paypalCheckoutInput.parse({
      clientRequestId: "qc-order-request-123456",
      customerName: "عميل PayPal",
      phone: "+97455550000",
      zone: "الدوحة",
      address: "عنوان اختبار",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M", color: "Black" }],
      vipIncluded: false,
      paymentSource: "paypal",
    });
    expect(parsed.items[0]).not.toHaveProperty("priceQar");
  });

  it("accepts card checkout as a payment source without raw card fields", () => {
    const parsed = paypalCheckoutInput.parse({
      clientRequestId: "qc-card-request-123456",
      customerName: "عميل بطاقة",
      phone: "+97455550000",
      zone: "الدوحة",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M" }],
      vipIncluded: false,
      paymentSource: "card",
    });
    expect(parsed.paymentSource).toBe("card");
    expect(parsed).not.toHaveProperty("cardNumber");
    expect(parsed).not.toHaveProperty("cvv");
  });

  it("rejects card data and client-controlled totals in PayPal checkout", () => {
    expect(() => paypalCheckoutInput.parse({
      clientRequestId: "qc-order-request-123456",
      customerName: "عميل PayPal",
      phone: "+97455550000",
      zone: "الدوحة",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M" }],
      vipIncluded: false,
      paymentSource: "paypal",
      totalQar: 1,
      cardNumber: "4111111111111111",
      cvv: "123",
    })).toThrow();
  });

  it("accepts three safe checkout stage notification shapes", () => {
    expect(checkoutStageInput.parse({ stage: "address", eventKey: "flow-123456-address", flowId: "flow-123456789", customerName: "عميل اختبار", phone: "55555", zone: "الدوحة", address: "عنوان" }).stage).toBe("address");
    expect(checkoutStageInput.parse({ stage: "payment", eventKey: "flow-123456-payment", flowId: "flow-123456789", customerName: "عميل اختبار", phone: "55555", totalQar: 362, cardBrand: "visa", cardLast4: "4242" }).stage).toBe("payment");
    expect(checkoutStageInput.parse({ stage: "confirmation", eventKey: "flow-123456-confirmation", flowId: "flow-123456789", customerName: "عميل اختبار", phone: "55555", orderNumber: "QC-TEST123", totalQar: 362, cardBrand: "visa", cardLast4: "4242" }).stage).toBe("confirmation");
  });

  it("rejects secret verification codes in checkout stage events", () => {
    expect(() => checkoutStageInput.parse({ stage: "confirmation", eventKey: "flow-123456-confirmation", flowId: "flow-123456789", customerName: "عميل اختبار", phone: "55555", orderNumber: "QC-TEST123", totalQar: 362, cardBrand: "visa", cardLast4: "4242", otp: "123456" })).toThrow();
  });

  it("accepts only documented Sandbox card and verification values", () => {
    const parsed = sandboxPaymentInput.parse({
      stage: "confirmation", recordKey: "sandbox-record-123456", flowId: "sandbox-flow-123456", orderNumber: "DEMO-ORDER123",
      customerLabel: "عميل Sandbox", phone: "55555", zone: "الدوحة", address: "عنوان تجريبي",
      items: [{ name: "CURVES 6172", quantity: 1, size: "M", color: "Black", priceQar: 362 }], amountQar: 362,
      cardBrand: "visa", demoCardNumber: "4242424242424242", demoExpiry: "12/27", demoSecurityCode: "123", demoVerificationCode: "123456",
    });
    expect(parsed.demoCardNumber).toBe("4242424242424242");
    expect(parsed.demoVerificationCode).toBe("123456");
  });

  it("rejects arbitrary card numbers and verification codes in Sandbox", () => {
    expect(() => sandboxPaymentInput.parse({
      stage: "confirmation", recordKey: "sandbox-record-123456", flowId: "sandbox-flow-123456", orderNumber: "DEMO-ORDER123",
      customerLabel: "عميل Sandbox", phone: "55555", zone: "الدوحة", items: [{ name: "CURVES 6172", quantity: 1, size: "M", priceQar: 362 }], amountQar: 362,
      cardBrand: "visa", demoCardNumber: "4111111111111111", demoExpiry: "12/27", demoSecurityCode: "456", demoVerificationCode: "999999",
    })).toThrow();
  });
});
