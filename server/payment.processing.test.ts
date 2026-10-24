import { describe, expect, it } from "vitest";
import {
  PAY_NOW_LABEL,
  PAYMENT_PROCESSING_STEPS,
  paymentProcessingCopy,
  paymentProcessingStepIndex,
} from "../client/src/lib/paymentProcessing";

describe("payment processing progress", () => {
  it("uses the concise Arabic pay-now label", () => {
    expect(PAY_NOW_LABEL).toBe("ادفع الآن");
  });

  it("keeps the processing stages in the expected safe order", () => {
    expect(PAYMENT_PROCESSING_STEPS.map(step => step.id)).toEqual([
      "creating",
      "awaiting_bank",
      "confirming",
    ]);
    expect(paymentProcessingStepIndex("creating")).toBe(0);
    expect(paymentProcessingStepIndex("awaiting_bank")).toBe(1);
    expect(paymentProcessingStepIndex("confirming")).toBe(2);
  });

  it("explains bank verification without asking for an OTP inside the store", () => {
    const copy = paymentProcessingCopy("awaiting_bank");
    expect(copy.title).toContain("موافقة البنك");
    expect(copy.detail).toContain("لا تدخلي رمز التحقق داخل موقع المتجر");
  });

  it("warns the customer not to close or reload during final confirmation", () => {
    const copy = paymentProcessingCopy("confirming");
    expect(copy.title).toContain("تأكيد الدفع");
    expect(copy.detail).toContain("لا تغلقي الصفحة");
    expect(copy.detail).toContain("تعيدي تحميلها");
  });
});
