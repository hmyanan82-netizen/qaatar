import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { cartQuickSummary, readCart, writeCart, type CartState } from "@/lib/cart";
import {
  PAY_NOW_LABEL,
  PAYMENT_PROCESSING_STEPS,
  paymentProcessingCopy,
  paymentProcessingStepIndex,
  type PaymentProcessingStage,
} from "@/lib/paymentProcessing";
import { paymentValidationMessage } from "@/lib/paymentValidation";
import { beginPaypalRequest, clearPaypalRequest, readPaypalRequest } from "@/lib/paypalRequest";
import { trpc } from "@/lib/trpc";
import { CheckoutHeader } from "./CheckoutPage";

type CheckoutProfile = { name: string; phone: string; zone: string; address?: string };
type CardField = { render(selector: string): Promise<void> };
type CardFields = {
  isEligible(): boolean;
  NameField(options?: Record<string, unknown>): CardField;
  NumberField(options?: Record<string, unknown>): CardField;
  ExpiryField(options?: Record<string, unknown>): CardField;
  CVVField(options?: Record<string, unknown>): CardField;
  submit(options?: Record<string, unknown>): Promise<void>;
};
type PaypalButtons = {
  isEligible(): boolean;
  render(container: HTMLElement): Promise<void>;
};
type PaypalSecureFieldsSdk = {
  FUNDING: { CARD: string };
  Buttons(options: Record<string, unknown>): PaypalButtons;
  CardFields(options: Record<string, unknown>): CardFields;
};

declare global {
  interface Window {
    paypalSecureFields?: PaypalSecureFieldsSdk;
  }
}

function loadScript(id: string, src: string, attributes: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${id}`)), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${id}`)), { once: true });
    document.head.appendChild(script);
  });
}

function checkoutProfile(): CheckoutProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem("qatar-curves-checkout") || "null");
    if (!parsed?.name || !parsed?.phone || !parsed?.zone) return null;
    return parsed;
  } catch {
    return null;
  }
}

const hostedFieldStyle = {
  input: {
    color: "#252220",
    direction: "rtl",
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
    fontWeight: "600",
    height: "54px",
    padding: "0 16px",
    transition: "color 160ms ease, box-shadow 160ms ease",
  },
  ":focus": {
    color: "#8d2430",
  },
  ".invalid": {
    color: "#b91c1c",
  },
};

function HostedField({ id, label, wide = false }: { id: string; label: string; wide?: boolean }) {
  return <label className={wide ? "block sm:col-span-2" : "block"}>
    <span className="mb-2 block text-xs font-extrabold text-[#514a45]">{label}</span>
    <span id={id} className="block h-14 overflow-hidden rounded-xl border border-[#d8cbbf] bg-white shadow-[0_5px_18px_rgba(37,34,32,.06)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[#a96c73] hover:shadow-[0_9px_24px_rgba(88,35,45,.10)] focus-within:border-[#8d2430] focus-within:ring-4 focus-within:ring-[#8d2430]/10" />
  </label>;
}

function PaymentProcessingPanel({ stage }: { stage: PaymentProcessingStage }) {
  const copy = paymentProcessingCopy(stage);
  const activeIndex = paymentProcessingStepIndex(stage);

  return <div role="status" aria-live="polite" aria-atomic="true" className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-[#f7f2ec] shadow-[0_16px_38px_rgba(4,120,87,.12)]">
    <div className="flex items-start gap-4 p-5 sm:p-6">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_9px_22px_rgba(4,120,87,.24)]">
        <span className="absolute inset-0 rounded-full border border-emerald-300 motion-safe:animate-ping motion-reduce:hidden" />
        <LoaderCircle className="motion-safe:animate-spin" size={23} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-base text-[#252220]">{copy.title}</strong>
        <p className="mt-1 text-xs leading-6 text-[#746c64]">{copy.detail}</p>
      </div>
      <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-black tracking-wide text-emerald-700">SECURE</span>
    </div>
    <div className="grid grid-cols-3 gap-2 border-t border-emerald-100 bg-white/70 px-4 py-4 sm:px-6">
      {PAYMENT_PROCESSING_STEPS.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        return <div key={step.id} className="flex min-w-0 items-center gap-2">
          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black transition-[background-color,color,transform] duration-200 ${completed ? "bg-emerald-700 text-white" : active ? "scale-105 bg-[#8d2430] text-white" : "bg-[#ece1d6] text-[#8f857c]"}`}>
            {completed ? <CheckCircle2 size={14} /> : index + 1}
          </span>
          <span className={`truncate text-[10px] font-bold sm:text-[11px] ${active || completed ? "text-[#3f3935]" : "text-[#9a9087]"}`}>{step.label}</span>
        </div>;
      })}
    </div>
  </div>;
}

function QuickPaymentSummary({ cart }: { cart: CartState }) {
  const summary = cartQuickSummary(cart);
  const visibleProducts = summary.productLines.slice(0, 2);
  const remainingProducts = Math.max(0, summary.productLines.length - visibleProducts.length);

  return <div aria-label="ملخص الدفع" className="rounded-xl border border-[#d8cbbf] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(37,34,32,.06)] sm:px-5">
    <div className="flex items-center justify-between gap-4 border-b border-[#eee5dc] pb-3">
      <div>
        <strong className="block text-sm text-[#252220]">ملخص الدفع</strong>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#746c64]">
          <span>{summary.itemCount.toLocaleString("ar-QA")} {summary.itemCount === 1 ? "قطعة" : "قطع"}</span>
          {summary.vipIncluded && <><span aria-hidden="true">•</span><span>خدمة VIP</span></>}
          <span aria-hidden="true">•</span><span>التوصيل مجاني</span>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <span className="block text-[10px] text-[#746c64]">الإجمالي</span>
        <strong className="mt-0.5 block text-xl text-[#8d2430]">{summary.totalQar.toLocaleString("ar-QA")} ر.ق</strong>
      </div>
    </div>
    {(visibleProducts.length > 0 || summary.vipIncluded) && <p className="mt-3 truncate text-[11px] leading-5 text-[#746c64]">
      {visibleProducts.map(item => `${item.name} × ${item.quantity}`).join(" · ")}
      {remainingProducts > 0 ? ` · و${remainingProducts.toLocaleString("ar-QA")} أخرى` : ""}
      {summary.vipIncluded ? `${visibleProducts.length ? " · " : ""}خدمة VIP` : ""}
    </p>}
  </div>;
}

export default function PayPalCheckoutPage() {
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartState>({ items: [] });
  const [cartReady, setCartReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [submitting, setSubmitting] = useState(false);
  const [processingStage, setProcessingStage] = useState<PaymentProcessingStage | null>(null);
  const [fieldMode, setFieldMode] = useState<"custom" | "standard" | null>(null);
  const initialized = useRef(false);
  const cardFieldsRef = useRef<CardFields | null>(null);
  const standardButtonRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const createOrder = trpc.paypal.createOrder.useMutation();
  const captureOrder = trpc.paypal.captureOrder.useMutation();
  const cancelOrder = trpc.paypal.cancelOrder.useMutation();
  const createOrderRef = useRef(createOrder.mutateAsync);
  const captureOrderRef = useRef(captureOrder.mutateAsync);
  const cancelOrderRef = useRef(cancelOrder.mutate);
  const { data: configuration, error: configurationError } = trpc.paypal.configuration.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => { createOrderRef.current = createOrder.mutateAsync; }, [createOrder.mutateAsync]);
  useEffect(() => { captureOrderRef.current = captureOrder.mutateAsync; }, [captureOrder.mutateAsync]);
  useEffect(() => { cancelOrderRef.current = cancelOrder.mutate; }, [cancelOrder.mutate]);
  useEffect(() => {
    setCart(readCart());
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (!configuration || !cartReady || initialized.current) return;
    initialized.current = true;
    let disposed = false;

    const profile = checkoutProfile();
    if (!profile || (!cart.items.length && !cart.vip)) {
      setStatus("error");
      setMessageType("error");
      setMessage("أكملي بيانات التوصيل والسلة أولًا قبل الدفع.");
      return;
    }

    const create = async () => {
      setSubmitting(true);
      setProcessingStage("creating");
      setMessageType("info");
      setMessage("جارٍ تجهيز عملية الدفع الآمنة...");
      const activeCart = readCart();
      const activeProfile = checkoutProfile();
      if (!activeProfile || (!activeCart.items.length && !activeCart.vip)) throw new Error("بيانات الطلب غير مكتملة");
      const clientRequestId = beginPaypalRequest(localStorage);
      activeRequestIdRef.current = clientRequestId;
      const result = await createOrderRef.current({
        clientRequestId,
        customerName: activeProfile.name,
        phone: activeProfile.phone,
        zone: activeProfile.zone,
        address: activeProfile.address,
        items: activeCart.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
        vipIncluded: Boolean(activeCart.vip),
        paymentSource: "card",
      });
      setProcessingStage("awaiting_bank");
      setMessage("تابعي نافذة التحقق البنكي إذا ظهرت لإكمال العملية بأمان.");
      return result.orderId;
    };

    const complete = async (orderId: string) => {
      setSubmitting(true);
      setProcessingStage("confirming");
      setMessageType("info");
      setMessage("جارٍ تأكيد الدفع الآمن...");
      const clientRequestId = activeRequestIdRef.current ?? readPaypalRequest(localStorage);
      if (!clientRequestId) throw new Error("انتهت جلسة الدفع. أعيدي المحاولة من زر الدفع.");
      const result = await captureOrderRef.current({
        paypalOrderId: orderId,
        clientRequestId,
      });
      localStorage.setItem("qatar-curves-last-order", JSON.stringify({ orderNumber: result.orderNumber }));
      clearPaypalRequest(localStorage);
      activeRequestIdRef.current = null;
      writeCart({ items: [] });
      navigate("/checkout/success");
    };

    const handleCardError = (error: unknown) => {
      console.error("[Secure Card Fields]", error);
      clearPaypalRequest(localStorage);
      activeRequestIdRef.current = null;
      setSubmitting(false);
      setProcessingStage(null);
      setMessageType("error");
      setMessage(paymentValidationMessage(error));
    };

    const initialize = async () => {
      try {
        const script = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(configuration.clientId)}&currency=${configuration.currency}&intent=capture&components=buttons,card-fields,funding-eligibility&enable-funding=card&locale=ar_AE`;
        const sdkAttributes: Record<string, string> = { "data-namespace": "paypalSecureFields" };
        if (configuration.clientToken) sdkAttributes["data-client-token"] = configuration.clientToken;
        await loadScript("paypal-secure-card-fields-sdk", script, sdkAttributes);
        if (!window.paypalSecureFields) throw new Error("تعذر تحميل بوابة البطاقة");

        const cardFields = window.paypalSecureFields.CardFields({
          createOrder: create,
          onApprove: async (data: { orderID: string }) => complete(data.orderID),
          onCancel: (data: { orderID?: string }) => {
            if (data.orderID) cancelOrderRef.current({ paypalOrderId: data.orderID });
            clearPaypalRequest(localStorage);
            activeRequestIdRef.current = null;
            setSubmitting(false);
            setProcessingStage(null);
            setMessageType("info");
            setMessage("تم إلغاء الدفع. يمكنك المحاولة مرة أخرى.");
          },
          onError: handleCardError,
          style: hostedFieldStyle,
        });

        if (cardFields.isEligible()) {
          await Promise.all([
            cardFields.NameField({ placeholder: "الاسم على البطاقة", style: hostedFieldStyle }).render("#card-name-field"),
            cardFields.NumberField({ placeholder: "رقم البطاقة", style: hostedFieldStyle }).render("#card-number-field"),
            cardFields.ExpiryField({ placeholder: "MM/YY", style: hostedFieldStyle }).render("#card-expiry-field"),
            cardFields.CVVField({ placeholder: "CVV", style: hostedFieldStyle }).render("#card-cvv-field"),
          ]);
          cardFieldsRef.current = cardFields;
          if (!disposed) {
            setFieldMode("custom");
            setStatus("ready");
          }
          return;
        }

        if (!standardButtonRef.current) throw new Error("تعذر تجهيز الدفع الآن");
        const standardButton = window.paypalSecureFields.Buttons({
          fundingSource: window.paypalSecureFields.FUNDING.CARD,
          style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 54 },
          createOrder: create,
          onApprove: async (data: { orderID: string }) => complete(data.orderID),
          onCancel: (data: { orderID?: string }) => {
            if (data.orderID) cancelOrderRef.current({ paypalOrderId: data.orderID });
            clearPaypalRequest(localStorage);
            activeRequestIdRef.current = null;
            setSubmitting(false);
            setProcessingStage(null);
            setMessageType("info");
            setMessage("تم إلغاء الدفع. يمكنك المحاولة مرة أخرى.");
          },
          onError: handleCardError,
        });
        if (!standardButton.isEligible()) throw new Error("الدفع المباشر بالبطاقة غير متاح لهذا الحساب حاليًا");
        standardButtonRef.current.replaceChildren();
        await standardButton.render(standardButtonRef.current);
        if (!disposed) {
          setFieldMode("standard");
          setStatus("ready");
        }
      } catch (error) {
        console.error("[Secure card checkout]", error);
        if (!disposed) {
          setStatus("error");
          setMessageType("error");
          setMessage(error instanceof Error ? error.message : "تعذر تجهيز الدفع الآن");
        }
      }
    };

    void initialize();
    return () => { disposed = true; };
  }, [cart.items.length, cart.vip, cartReady, configuration, navigate]);

  const submitCard = async () => {
    if (!cardFieldsRef.current || submitting) return;
    setSubmitting(true);
    setProcessingStage("creating");
    setMessage("جارٍ تجهيز عملية الدفع الآمنة...");
    setMessageType("info");
    try {
      // Billing/delivery details are already collected on the previous step.
      // PayPal receives only the hosted card fields here; no duplicate address form is rendered.
      await cardFieldsRef.current.submit();
    } catch (error) {
      console.error("[Card submit]", error);
      clearPaypalRequest(localStorage);
      activeRequestIdRef.current = null;
      setSubmitting(false);
      setProcessingStage(null);
      setMessageType("error");
      setMessage(paymentValidationMessage(error));
    }
  };

  if (configurationError) {
    return <><CheckoutHeader active={1} /><main className="container py-14"><div className="mx-auto max-w-xl border border-red-200 bg-red-50 p-7 text-center text-red-800">تعذر الاتصال بخدمة الدفع الآن. حاول مرة أخرى بعد قليل.</div></main></>;
  }

  return <>
    <CheckoutHeader active={1} />
    <main className="container py-10 lg:py-16">
      <div className="mx-auto mb-8 max-w-3xl">
        <div className="eyebrow mb-3 text-[#8d2430]">VISA / MASTERCARD</div>
        <h1 className="display-serif text-4xl sm:text-5xl">الدفع بالبطاقة</h1>
        <p className="mt-3 text-sm leading-7 text-[#746c64]">أدخلي بيانات البطاقة فقط. بيانات التوصيل محفوظة من الخطوة السابقة ولن يُطلب إدخالها مرة أخرى.</p>
      </div>
      <div className="mx-auto max-w-3xl">
        <section className="space-y-5">
          <div aria-busy={Boolean(processingStage)} className="overflow-hidden border border-[#d8cbbf] bg-[#fbf8f4] shadow-[0_22px_70px_rgba(37,34,32,.08)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8cbbf] bg-[#252220] px-5 py-5 text-white sm:px-7">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-white/10"><CreditCard size={22} /></span><div><strong className="block">Visa أو Mastercard</strong><span className="mt-1 block text-xs text-white/65">تعبئة يدوية · معالجة مشفّرة</span></div></div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-200">دفع آمن</span>
            </header>
            <div className="space-y-4 p-5 sm:p-7">
              <div className="flex items-center justify-between rounded-2xl border border-[#d8cbbf] bg-white px-5 py-4 shadow-sm">
                <div><p className="text-sm font-extrabold text-[#252220]">بيانات الدفع فقط</p><p className="mt-1 text-xs text-[#746c64]">الاسم · رقم البطاقة · التاريخ · CVV</p></div>
                <div className="flex items-center gap-3"><strong className="text-lg italic tracking-wide text-[#17357a]">VISA</strong><span className="flex"><i className="mr-[-7px] size-7 rounded-full bg-[#eb001b]" /><i className="size-7 rounded-full bg-[#ff5f00]" /></span></div>
              </div>

              {status === "loading" && <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#d8cbbf] bg-white py-10 text-sm text-[#746c64] shadow-[0_10px_30px_rgba(37,34,32,.06)]"><LoaderCircle className="animate-spin text-[#8d2430]" size={20} /> جارٍ تجهيز حقول الدفع...</div>}

              <div className={status === "ready" && fieldMode === "custom" ? "space-y-4" : "hidden"}>
                <div className={`grid gap-4 rounded-2xl border bg-[#fcfaf8] p-4 shadow-[0_12px_34px_rgba(37,34,32,.07)] transition-[border-color,box-shadow] sm:grid-cols-2 ${messageType === "error" && message ? "border-red-300 ring-4 ring-red-100" : "border-[#d8cbbf]"}`}>
                  <HostedField id="card-name-field" label="الاسم على البطاقة" wide />
                  <HostedField id="card-number-field" label="رقم البطاقة" wide />
                  <HostedField id="card-expiry-field" label="تاريخ الانتهاء" />
                  <HostedField id="card-cvv-field" label="CVV" />
                </div>
                <QuickPaymentSummary cart={cart} />
                <button type="button" onClick={submitCard} disabled={submitting || Boolean(processingStage)} className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#252220] px-6 text-base font-extrabold text-white shadow-[0_12px_28px_rgba(37,34,32,.22)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-[#141312] hover:shadow-[0_16px_34px_rgba(37,34,32,.28)] active:scale-[.98] disabled:cursor-wait disabled:opacity-70">
                  {submitting ? <><LoaderCircle className="animate-spin" size={20} /> جارٍ تنفيذ الدفع...</> : PAY_NOW_LABEL}
                </button>
              </div>

              <div className={status === "ready" && fieldMode === "standard" ? "space-y-3" : "hidden"}>
                <QuickPaymentSummary cart={cart} />
                <div ref={standardButtonRef} className={`min-h-[54px] overflow-hidden rounded-xl bg-[#252220] transition-[opacity,transform] duration-200 ${processingStage ? "pointer-events-none scale-[.99] opacity-60" : ""}`} />
              </div>

              {processingStage && <PaymentProcessingPanel stage={processingStage} />}

              {message && !processingStage && <p role={messageType === "error" ? "alert" : "status"} aria-live={messageType === "error" ? "assertive" : "polite"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${messageType === "error" ? "border-red-300 bg-red-50 text-red-800 shadow-[0_8px_24px_rgba(185,28,28,.08)]" : "border-[#d8cbbf] bg-[#ece1d6] text-[#746c64]"}`}>{message}</p>}
              {status === "ready" && <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[10px] font-bold text-emerald-800 sm:text-[11px]">
                <span className="flex items-center gap-1.5"><CreditCard size={14} /> Visa وMastercard</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> اتصال مشفّر</span>
                <span className="flex items-center gap-1.5"><LockKeyhole size={14} /> لا نخزن البطاقة</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> 3D Secure عند الحاجة</span>
              </div>}
            </div>
          </div>
          <button type="button" onClick={() => navigate("/checkout/address")} disabled={Boolean(processingStage)} className="mx-auto flex items-center gap-2 text-sm text-[#746c64] transition-colors hover:text-[#8d2430] disabled:cursor-wait disabled:opacity-45"><ArrowRight size={16} /> العودة لبيانات التوصيل</button>
        </section>
      </div>
    </main>
  </>;
}
