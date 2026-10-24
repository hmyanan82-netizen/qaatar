import { describe, expect, it } from "vitest";
import { paymentValidationMessage } from "../client/src/lib/paymentValidation";

describe("paymentValidationMessage", () => {
  it("returns a specific Arabic message for an invalid card number", () => {
    expect(paymentValidationMessage(new Error("INVALID_CARD_NUMBER"))).toContain("رقم البطاقة غير صالح");
  });

  it("returns a specific Arabic message for an invalid expiration date", () => {
    expect(paymentValidationMessage({ issue: "INVALID_EXPIRY_YEAR" })).toContain("تاريخ انتهاء البطاقة غير صالح");
  });

  it("returns a safe generic message for unknown payment errors", () => {
    expect(paymentValidationMessage({ issue: "UNKNOWN" })).toContain("بيانات البطاقة غير صالحة");
  });
});
