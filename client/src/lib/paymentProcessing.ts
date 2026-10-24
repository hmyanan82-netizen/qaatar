export type PaymentProcessingStage = "creating" | "awaiting_bank" | "confirming";

export const PAY_NOW_LABEL = "ادفع الآن";

export const PAYMENT_PROCESSING_STEPS: ReadonlyArray<{
  id: PaymentProcessingStage;
  label: string;
}> = [
  { id: "creating", label: "تجهيز العملية" },
  { id: "awaiting_bank", label: "تحقق البنك" },
  { id: "confirming", label: "تأكيد الدفع" },
];

const PROCESSING_COPY: Record<PaymentProcessingStage, { title: string; detail: string }> = {
  creating: {
    title: "جارٍ إنشاء عملية دفع آمنة...",
    detail: "يتم التحقق من مبلغ الطلب وفتح الاتصال المشفّر مع مزوّد الدفع.",
  },
  awaiting_bank: {
    title: "العملية بانتظار موافقة البنك",
    detail: "تابعي نافذة التحقق البنكي إذا ظهرت. لا تدخلي رمز التحقق داخل موقع المتجر.",
  },
  confirming: {
    title: "جارٍ تأكيد الدفع وحفظ الطلب...",
    detail: "تمت الموافقة، ونؤكد التحصيل النهائي الآن. لا تغلقي الصفحة أو تعيدي تحميلها.",
  },
};

export function paymentProcessingCopy(stage: PaymentProcessingStage) {
  return PROCESSING_COPY[stage];
}

export function paymentProcessingStepIndex(stage: PaymentProcessingStage) {
  return PAYMENT_PROCESSING_STEPS.findIndex(step => step.id === stage);
}
