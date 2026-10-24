export function paymentValidationMessage(error: unknown) {
  let details = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (!details) {
    try {
      details = JSON.stringify(error ?? "");
    } catch {
      details = String(error ?? "");
    }
  }

  if (/expir|expiry|expiration|month|year/i.test(details)) {
    return "تاريخ انتهاء البطاقة غير صالح. تحققي من الشهر والسنة.";
  }

  if (/card.?number|number.?card|invalid.?card|account.?number/i.test(details)) {
    return "رقم البطاقة غير صالح. تحققي من الأرقام وأعيدي المحاولة.";
  }

  return "بيانات البطاقة غير صالحة. تحققي من الرقم وتاريخ الانتهاء ورمز CVV.";
}
