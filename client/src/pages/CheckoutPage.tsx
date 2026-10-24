/* Qatar Curves — professional checkout flow: calm editorial surfaces, clear progress, Qatar delivery zones, demo payment, six-digit verification. */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, CreditCard, LoaderCircle, LockKeyhole, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { cartTotal, readCart, SALE_PERCENT, writeCart, type CartState } from "@/lib/cart";
import { trpc } from "@/lib/trpc";
import { VISITOR_SESSION_KEY } from "@shared/visitorPresence";

const zones = ["الدوحة", "الريان", "أم صلال", "الوكرة", "الخور والذخيرة", "الشحانية", "الظعاين", "مسيعيد"];
const steps = [{ path: "/checkout/address", label: "العنوان" }, { path: "/checkout/payment", label: "الدفع" }, { path: "/checkout/verify", label: "التأكيد" }];
const CHECKOUT_FLOW_KEY = "qatar-curves-checkout-flow-id";
const SANDBOX_PAYMENT_KEY = "qatar-curves-sandbox-payment";
const SANDBOX_RECORD_KEY = "qatar-curves-sandbox-record-key";

function getCheckoutFlowId() {
  const stored = localStorage.getItem(CHECKOUT_FLOW_KEY);
  if (stored) return stored;
  const flowId = `${Date.now().toString(36)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  localStorage.setItem(CHECKOUT_FLOW_KEY, flowId);
  return flowId;
}

export function CheckoutHeader({ active }: { active: number }) {
  return <><div className="bg-[#252220] px-4 py-2 text-center text-[11px] tracking-[.14em] text-[#f7f2ec]">التوصيل مجاني داخل قطر <span className="mx-2 text-[#d8a5a8]">•</span> دفع آمن</div><header className="border-b border-[#d8cbbf]/70 bg-[#f7f2ec]"><div className="container flex h-[82px] items-center justify-between"><Link href="/" className="flex items-center gap-3"><img src="https://kwcurves.com/wp-content/uploads/2024/07/logo-curves.svg" alt="Curves logo" className="h-12 w-12 object-contain" /><span className="display-serif text-[26px] leading-none">Qatar Curves</span></Link><div className="hidden items-center gap-3 text-xs text-[#746c64] sm:flex"><LockKeyhole size={15} /> اتصال مشفّر وآمن</div></div></header><div className="border-b border-[#d8cbbf] bg-[#ece1d6]"><div className="container flex items-center justify-center gap-0 py-4 sm:gap-8">{steps.map((step, index) => <div key={step.path} className="flex items-center"><div className={`flex items-center gap-2 text-xs font-semibold ${index <= active ? "text-[#8d2430]" : "text-[#9a8e83]"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ${index < active ? "border-[#8d2430] bg-[#8d2430] text-white" : index === active ? "border-[#8d2430] bg-[#f7f2ec]" : "border-[#c9b9aa] bg-transparent"}`}>{index < active ? <Check size={14} /> : index + 1}</span><span>{step.label}</span></div>{index < steps.length - 1 && <span className={`mx-3 h-px w-8 sm:mx-6 sm:w-16 ${index < active ? "bg-[#8d2430]" : "bg-[#c9b9aa]"}`} />}</div>)}</div></div></>;
}

export function SummaryCard() {
  const [cart, setCart] = useState<CartState>({ items: [] });
  useEffect(() => { const sync = () => setCart(readCart()); sync(); window.addEventListener("qatar-cart-change", sync); return () => window.removeEventListener("qatar-cart-change", sync); }, []);
  const money = (value: number) => `${value.toLocaleString("ar-QA")} ر.ق`;
  const total = cartTotal(cart);
  const originalTotal = cart.items.reduce((sum, item) => sum + (item.originalPriceQar ?? item.priceQar / (1 - SALE_PERCENT / 100)) * item.quantity, 0) + (cart.vip?.priceQar || 0);
  return <aside className="h-fit border border-[#d8cbbf] bg-[#ece1d6] p-4 sm:p-5"><div className="mb-4 flex flex-col items-start gap-1"><h2 className="display-serif text-2xl sm:text-3xl">ملخص الطلب</h2><span className="text-xs text-[#746c64]">{cart.items.reduce((sum, item) => sum + item.quantity, 0)} قطعة</span></div>{cart.items.length || cart.vip ? <><div className="space-y-3 border-b border-[#c9b9aa] pb-4">{cart.items.map((item) => <div key={item.id} className="flex gap-3"><img src={item.image} alt={item.name} className="h-20 w-16 bg-[#f7f2ec] object-contain" /><div className="min-w-0 flex-1"><p className="mb-1 text-sm font-semibold">{item.name}</p><p className="text-xs leading-5 text-[#746c64]">المقاس: {item.size}<br />اللون: {item.color === "Beige" ? "بيج" : item.color === "Black" ? "أسود" : "كاكاو"}<br />العمر: {item.age} سنة<br />الكمية: {item.quantity}</p><div className="mt-2 flex items-center gap-2"><strong className="text-sm text-[#8d2430]">{money(item.priceQar * item.quantity)}</strong><del className="text-[11px] text-[#8f857c]">{money((item.originalPriceQar ?? item.priceQar / (1 - SALE_PERCENT / 100)) * item.quantity)}</del></div></div></div>)}{cart.vip && <div className="flex items-start justify-between border-t border-[#c9b9aa] pt-4"><span><strong className="block text-sm">خدمة VIP</strong><span className="text-xs leading-6 text-[#746c64]">{cart.vip.date} · {cart.vip.time}<br />{cart.vip.zone}</span></span><span className="text-sm font-semibold">{money(cart.vip.priceQar)}</span></div>}</div><div className="space-y-2 pt-4 text-sm"><div className="flex justify-between text-xs text-[#746c64]"><span>السعر قبل الخصم</span><del>{money(originalTotal)}</del></div><div className="flex justify-between text-xs font-semibold text-[#8d2430]"><span>خصم {SALE_PERCENT}%</span><span>- {money(originalTotal - total)}</span></div><div className="flex items-center justify-between rounded-sm bg-[#f7f2ec] px-3 py-2"><span className="flex items-center gap-2 text-[#746c64]"><MapPin size={14} className="text-[#8d2430]" />التوصيل داخل قطر</span><span className="font-semibold text-[#8d2430]">مجاني</span></div><div className="mt-3 flex justify-between border-t border-[#c9b9aa] pt-3 text-base font-semibold"><span>الإجمالي</span><span>{money(total)}</span></div></div></> : <p className="border-t border-[#c9b9aa] pt-5 text-sm leading-7 text-[#746c64]">السلة فارغة. اختاري منتجًا من أفضل المبيعات أولًا.</p>}</aside>;
}

function Field({ label, placeholder, value, onChange, type = "text", autoComplete, inputMode, maxLength, inputClassName = "", adornment }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; inputMode?: "text" | "numeric" | "tel" | "email"; maxLength?: number; inputClassName?: string; adornment?: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">{label}</span><span className="relative block"><input required type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} className={`w-full rounded-xl border border-[#d1c4b5] bg-white px-4 py-3.5 text-[15px] shadow-sm outline-none transition-all duration-200 placeholder:text-[#b8a99a] focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)] ${inputClassName}`} />{adornment && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{adornment}</span>}</span></label>;
}

function VisaLogo({ size = 48 }: { size?: number }) {
  const h = size * 0.6;
  return <svg width={size} height={h} viewBox="0 0 80 48" fill="none"><rect width="80" height="48" rx="4" fill="#1a1f71" stroke="#141a5e" strokeWidth="1"/><rect y="38" width="80" height="6" fill="#f7a600"/><text x="40" y="30" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif">VISA</text></svg>;
}
function MastercardLogo({ size = 48 }: { size?: number }) {
  const h = size * 0.7;
  return <svg width={size} height={h} viewBox="0 0 72 50" fill="none"><circle cx="26" cy="25" r="20" fill="#eb001b"/><circle cx="46" cy="25" r="20" fill="#f79e1b"/><path d="M36 9.2a20 20 0 0 1 0 31.6 20 20 0 0 1 0-31.6Z" fill="#ff5f00"/></svg>;
}
function AmexLogo({ size = 48 }: { size?: number }) {
  const h = size * 0.6;
  return <svg width={size} height={h} viewBox="0 0 80 48" fill="none"><rect width="80" height="48" rx="4" fill="#016fd0"/><text x="40" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial, sans-serif">AMERICAN</text><text x="40" y="36" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="Arial, sans-serif">EXPRESS</text></svg>;
}
function HimyanLogo({ size = 48 }: { size?: number }) {
  const h = size * 0.6;
  return <svg width={size} height={h} viewBox="0 0 90 54" fill="none"><text x="52" y="22" textAnchor="middle" fill="#1a1a1a" fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif">هميان</text><text x="52" y="38" textAnchor="middle" fill="#1a1a1a" fontSize="9" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="2">HIMYAN</text><path d="M12 10 L26 27 L12 27 Z" fill="#8d1b3d"/><path d="M16 10 L30 27 L16 27 Z" fill="#b0223f" opacity="0.7"/></svg>;
}

function detectCardBrand(number: string): "visa" | "mastercard" | "mada" | "amex" | "" {
  const d = number.replace(/\s/g, "");
  if (!d) return "";
  if (d.startsWith("5888")) return "mada";
  if (/^3[47]/.test(d)) return "amex";
  if (d.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard";
  return "";
}

function luhnCheck(number: string): boolean {
  const d = number.replace(/\s/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isExpiryValid(month: string, year: string): boolean {
  if (!month || !year) return true;
  const now = new Date();
  const ey = parseInt(year, 10);
  const em = parseInt(month, 10);
  return ey > now.getFullYear() || (ey === now.getFullYear() && em >= now.getMonth() + 1);
}

function AutoCardBadge({ number }: { number: string }) {
  const digits = number.replace(/\s/g, "");
  const brand = detectCardBrand(number);
  const isComplete = digits.length >= 13;
  const valid = isComplete && luhnCheck(number);

  if (!digits) return <CreditCard size={22} className="text-[#b8a99a]" />;

  return (
    <span className="flex items-center gap-1.5">
      {brand === "visa" && <VisaLogo size={44} />}
      {brand === "mastercard" && <MastercardLogo size={40} />}
      {brand === "amex" && <AmexLogo size={44} />}
      {brand === "mada" && <HimyanLogo size={44} />}
      {!brand && digits.length > 0 && <CreditCard size={22} className="text-[#9a8e83]" />}
      {isComplete && (valid
        ? <Check size={16} strokeWidth={3} className="text-[#159447]" />
        : <AlertCircle size={16} className="text-[#c53030]" />
      )}
    </span>
  );
}

function AddressStep() {
  const [, navigate] = useLocation();
  const registerCustomer = trpc.analytics.registerCustomer.useMutation();
  const recordStage = trpc.analytics.recordCheckoutStage.useMutation();
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [zone, setZone] = useState(""); const [address, setAddress] = useState(""); const [error, setError] = useState(""); const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!zone) { setError("اختاري منطقة التوصيل للمتابعة"); return; } setError(""); setIsSubmitting(true); const sessionKey = sessionStorage.getItem(VISITOR_SESSION_KEY) ?? undefined; const flowId = getCheckoutFlowId(); localStorage.setItem("qatar-curves-checkout", JSON.stringify({ name, phone, zone, address })); try { await recordStage.mutateAsync({ stage: "address", eventKey: `${flowId}-address`, flowId, sessionKey, customerName: name, phone, zone, address }); registerCustomer.mutate({ sessionKey, name, phone, zone, address }); navigate("/checkout/payment"); } catch { setError("تعذر حفظ بيانات العنوان مؤقتًا، حاولي مرة أخرى"); setIsSubmitting(false); } };
  return <><CheckoutHeader active={0} /><main className="container py-10 lg:py-16"><div className="mb-10 max-w-[620px]"><div className="eyebrow mb-3 text-[#8d2430]">CHECKOUT / ٠١</div><h1 className="display-serif text-5xl sm:text-6xl">إلى أين نرسل<br /><em className="font-normal text-[#8d2430]">اختيارك؟</em></h1><p className="mt-4 text-sm leading-7 text-[#746c64]">أدخلي بيانات التوصيل داخل قطر.</p><div className="mt-5 inline-flex items-center gap-2 border border-[#c9b9aa] bg-[#ece1d6] px-4 py-2 text-xs font-semibold text-[#8d2430]"><MapPin size={14} /> التوصيل مجاني داخل قطر</div></div><div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16"><form onSubmit={submit} className="order-last space-y-7 lg:order-first"><div className="grid gap-5 sm:grid-cols-2"><Field label="الاسم الكامل" placeholder="مثال: نورة محمد" value={name} onChange={setName} autoComplete="name" /><Field label="رقم الهاتف" placeholder="+974 0000 0000" value={phone} onChange={setPhone} type="tel" autoComplete="tel" /></div><label className="block"><span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">المنطقة داخل قطر</span><span className="relative block"><select required value={zone} onChange={(event) => { setZone(event.target.value); setError(""); }} className="w-full appearance-none rounded-xl border border-[#d1c4b5] bg-white px-4 py-3.5 text-[15px] shadow-sm outline-none transition-all duration-200 focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)]"><option value="">اختاري المنطقة</option>{zones.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute left-4 top-4 text-[#9a8e83]" size={17} /></span></label><Field label="العنوان بالتفصيل" placeholder="الشارع، المبنى، رقم الشقة أو الفيلا" value={address} onChange={setAddress} autoComplete="street-address" />{error && <p className="text-sm text-[#8d2430]">{error}</p>}<div className="flex flex-col-reverse gap-4 border-t border-[#d8cbbf] pt-6 sm:flex-row sm:items-center sm:justify-between"><Link href="/#bestsellers" className="text-sm text-[#746c64] transition-colors hover:text-[#8d2430]">العودة للمتجر</Link><button disabled={isSubmitting} className="pill-button gap-3 bg-[#252220] px-8 py-3 text-sm font-semibold text-white hover:bg-[#8d2430] disabled:cursor-wait disabled:opacity-70">{isSubmitting ? "جارٍ حفظ التسجيل" : "المتابعة للدفع"} <ArrowLeft size={17} /></button></div></form><div className="order-first lg:order-last"><SummaryCard /></div></div></main></>;
}

function PaymentStep() {
  const [, navigate] = useLocation();
  const createSandboxPayment = trpc.analytics.createSandboxPayment.useMutation();
  const [card, setCard] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState(""); const [cvv, setCvv] = useState(""); const [holder, setHolder] = useState(""); const [error, setError] = useState(() => localStorage.getItem("qatar-curves-payment-error") || ""); const [isSubmitting, setIsSubmitting] = useState(false);
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
  const years = Array.from({ length: 35 }, (_, i) => String(2026 + i));
  const validCards: Record<string, "visa" | "mastercard" | "mada"> = { "4242424242424242": "visa", "5555555555554444": "mastercard", "5888450000000000": "mada" };
  useEffect(() => { localStorage.removeItem("qatar-curves-payment-error"); }, []);

  const rawCard = card.replace(/\s/g, "");
  const detectedBrand = useMemo(() => detectCardBrand(card), [card]);
  const cardValid = rawCard.length >= 13 && luhnCheck(card);
  const cardComplete = rawCard.length >= 13;
  const expiryValid = isExpiryValid(month, year);
  const expiryTouched = month !== "" && year !== "";
  const cvvValid = cvv.length === 3;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const digits = rawCard;
    const method = validCards[digits];

    if (!holder.trim()) { setError("أدخلي الاسم على البطاقة"); return; }
    if (!cardComplete) { setError("أدخلي رقم البطاقة كاملاً"); return; }
    if (!cardValid) { setError("رقم البطاقة غير صحيح"); return; }
    if (!method) { setError("رقم البطاقة غير مدعوم"); return; }
    if (!month || !year) { setError("اختاري تاريخ انتهاء البطاقة"); return; }
    if (!expiryValid) { setError("تاريخ انتهاء البطاقة منتهي الصلاحية"); return; }
    if (!cvvValid) { setError("أدخلي رمز الأمان (3 أرقام)"); return; }

    const checkout = JSON.parse(localStorage.getItem("qatar-curves-checkout") || "null");
    const cart = readCart();
    if (!checkout || !cart.items.length) { setError("أدخلي بيانات الطلب أولًا"); return; }

    setError(""); setIsSubmitting(true);
    const flowId = getCheckoutFlowId();
    const demoCardNumber = digits as "4242424242424242" | "5555555555554444" | "5888450000000000";
    const demoSecurityCode = cvv as "123" | "999";
    const demoExpiry = `${month}/${year.slice(-2)}`;
    try {
      await createSandboxPayment.mutateAsync({ stage: "payment", recordKey: `${flowId}-payment-${Date.now().toString(36)}`, flowId, customerLabel: checkout.name, phone: checkout.phone, zone: checkout.zone, address: checkout.address, items: cart.items.map(item => ({ name: item.name, quantity: item.quantity, size: item.size, color: item.color, priceQar: item.priceQar })), amountQar: cartTotal(cart), cardBrand: method, demoCardNumber, demoExpiry, demoSecurityCode });
      localStorage.setItem(SANDBOX_PAYMENT_KEY, JSON.stringify({ cardBrand: method, demoCardNumber, demoExpiry, demoSecurityCode, holder }));
      navigate("/checkout/verify");
    } catch { setError("تعذر إرسال البيانات، حاولي مرة أخرى"); setIsSubmitting(false); }
  };
  const cardNumber = (value: string) => value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  return <><CheckoutHeader active={1} /><main className="container py-10 lg:py-16">
    <div className="mb-8 max-w-[720px]">
      <h1 className="display-serif text-4xl sm:text-5xl">صفحة الدفع</h1>
      <p className="mt-3 text-sm leading-7 text-[#746c64]">أدخلي بيانات البطاقة لإتمام عملية الشراء بأمان.</p>
    </div>
    <form onSubmit={submit} className="max-w-[680px] space-y-6">
      <div className="rounded-2xl border border-[#d1c4b5] bg-white p-6 shadow-sm sm:p-8">
        {/* Accepted payment methods */}
        <div className="mb-6 flex items-center justify-center gap-5 px-2 py-3">
          <VisaLogo size={52} /><MastercardLogo size={44} /><AmexLogo size={52} /><HimyanLogo size={56} />
        </div>

        <div className="space-y-5">
          {/* Card Holder */}
          <Field label="الاسم على البطاقة" placeholder="الاسم الكامل" value={holder} onChange={setHolder} autoComplete="cc-name" inputClassName="text-right" />

          {/* Card Number with auto-detect */}
          <div>
            <span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">رقم البطاقة</span>
            <span className="relative block">
              <input required value={card} onChange={(e) => { setCard(cardNumber(e.target.value)); setError(""); }} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} dir="ltr" className={`w-full rounded-xl border bg-white py-3.5 pr-4 pl-20 text-center text-[17px] tracking-[.18em] shadow-sm outline-none transition-all duration-200 placeholder:text-[#b8a99a] placeholder:tracking-[.18em] ${cardComplete ? (cardValid ? "border-[#159447] shadow-[0_0_0_3px_rgba(21,148,71,.1)]" : "border-[#c53030] shadow-[0_0_0_3px_rgba(197,48,48,.1)]") : "border-[#d1c4b5] focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)]"}`} />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"><AutoCardBadge number={card} /></span>
            </span>
            {cardComplete && !cardValid && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#c53030]"><AlertCircle size={13} /> رقم البطاقة غير صحيح</p>}
            {cardComplete && cardValid && <p className="mt-1.5 flex items-center gap-1 text-xs text-[#159447]"><Check size={13} strokeWidth={3} /> رقم البطاقة صحيح {detectedBrand === "visa" ? "— Visa" : detectedBrand === "mastercard" ? "— Mastercard" : detectedBrand === "amex" ? "— American Express" : detectedBrand === "mada" ? "— هميان" : ""}</p>}
          </div>

          {/* CVV + Month + Year */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div>
              <span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">رمز الأمان</span>
              <input required value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="CVV" inputMode="numeric" maxLength={3} autoComplete="cc-csc" dir="ltr" className={`h-[50px] w-full rounded-xl border bg-white text-center text-[15px] shadow-sm outline-none transition-all duration-200 placeholder:text-[#b8a99a] ${cvv.length === 3 ? "border-[#159447]" : cvv.length > 0 && cvv.length < 3 ? "border-[#d1c4b5] focus:border-[#8d2430]" : "border-[#d1c4b5] focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)]"}`} />
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">الشهر</span>
              <span className="relative block">
                <select required value={month} onChange={(e) => setMonth(e.target.value)} autoComplete="cc-exp-month" className={`h-[50px] w-full appearance-none rounded-xl border bg-white px-4 text-center text-[15px] shadow-sm outline-none transition-all duration-200 focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)] ${expiryTouched && !expiryValid ? "border-[#c53030]" : "border-[#d1c4b5]"}`}><option value="">—</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                <ChevronDown className="pointer-events-none absolute left-3 top-4 text-[#9a8e83]" size={16} />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold tracking-wide text-[#4a3f37]">السنة</span>
              <span className="relative block">
                <select required value={year} onChange={(e) => setYear(e.target.value)} autoComplete="cc-exp-year" className={`h-[50px] w-full appearance-none rounded-xl border bg-white px-4 text-center text-[15px] shadow-sm outline-none transition-all duration-200 focus:border-[#8d2430] focus:shadow-[0_0_0_3px_rgba(141,36,48,.12)] ${expiryTouched && !expiryValid ? "border-[#c53030]" : "border-[#d1c4b5]"}`}><option value="">—</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                <ChevronDown className="pointer-events-none absolute left-3 top-4 text-[#9a8e83]" size={16} />
              </span>
            </label>
          </div>
          {expiryTouched && !expiryValid && <p className="flex items-center gap-1 text-xs text-[#c53030]"><AlertCircle size={13} /> تاريخ انتهاء البطاقة منتهي الصلاحية</p>}
        </div>
      </div>

      {error && <p className="rounded-xl bg-[#8d2430]/10 px-4 py-3 text-center text-sm font-semibold text-[#8d2430]">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="pill-button w-full gap-3 rounded-xl bg-[#8d2430] px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-[#252220] disabled:opacity-90">تأكيد الدفع <ArrowLeft size={18} /></button>
      <button type="button" onClick={() => navigate("/checkout/address")} className="mx-auto flex items-center justify-center gap-2 text-sm text-[#746c64] hover:text-[#8d2430]"><ArrowRight size={16} /> العودة للعنوان</button>
    </form>
  </main></>;
}

function VerifyStep() {
  const [, navigate] = useLocation();
  const createSandboxPayment = trpc.analytics.createSandboxPayment.useMutation();
  const [flowId] = useState(() => getCheckoutFlowId());
  const [code, setCode] = useState(["", "", "", "", "", ""]); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [isSubmitting, setIsSubmitting] = useState(false); const [awaitingDecision, setAwaitingDecision] = useState(false); const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const { data: decision } = trpc.analytics.sandboxPaymentDecision.useQuery({ flowId }, { enabled: awaitingDecision, refetchInterval: 2000, retry: 2 });
  useEffect(() => {
    if (!awaitingDecision || !decision) return;
    if (decision.status === "approved") { localStorage.setItem("qatar-curves-last-order", JSON.stringify({ orderNumber: decision.orderNumber })); localStorage.removeItem(SANDBOX_PAYMENT_KEY); localStorage.removeItem(SANDBOX_RECORD_KEY); localStorage.removeItem(CHECKOUT_FLOW_KEY); writeCart({ items: [] }); navigate("/checkout/success"); }
    if (decision.status === "rejected") { localStorage.setItem("qatar-curves-payment-error", "تم رفض الدفع. أدخلي بيانات مختلفة للمتابعة."); localStorage.removeItem(SANDBOX_PAYMENT_KEY); localStorage.removeItem(SANDBOX_RECORD_KEY); setAwaitingDecision(false); setIsSubmitting(false); navigate("/checkout/payment"); }
  }, [awaitingDecision, decision, navigate]);
  const update = (index: number, value: string) => { const digit = value.replace(/\D/g, "").slice(-1); setCode(current => { const next = [...current]; next[index] = digit; return next; }); setError(""); if (digit && index < 5) inputs.current[index + 1]?.focus(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (isSubmitting) return; const enteredCode = code.join(""); if (!["123456", "654321"].includes(enteredCode)) { setError("أدخلي كود التحقق 123456 أو 654321"); return; } const demoVerificationCode = enteredCode as "123456" | "654321";
    const checkout = JSON.parse(localStorage.getItem("qatar-curves-checkout") || "null"); const payment = JSON.parse(localStorage.getItem(SANDBOX_PAYMENT_KEY) || "null"); const cart = readCart();
    if (!checkout || !payment?.demoCardNumber || !cart.items.length) { setError("تعذر العثور على بيانات الطلب، عودي للسلة وحاولي مجددًا"); return; }
    setError(""); setNotice(""); setIsSubmitting(true); const storedKey = localStorage.getItem(SANDBOX_RECORD_KEY); const recordKey = storedKey || `${Date.now().toString(36)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`; localStorage.setItem(SANDBOX_RECORD_KEY, recordKey); const orderNumber = `DEMO-${recordKey.replaceAll("-", "").slice(0, 18).toUpperCase()}`;
    try { await createSandboxPayment.mutateAsync({ stage: "confirmation", recordKey: `${recordKey}-confirmation`, flowId, orderNumber, customerLabel: checkout.name, phone: checkout.phone, zone: checkout.zone, address: checkout.address, items: cart.items.map(item => ({ name: item.name, quantity: item.quantity, size: item.size, color: item.color, priceQar: item.priceQar })), cardBrand: payment.cardBrand, demoCardNumber: payment.demoCardNumber, demoExpiry: payment.demoExpiry, demoSecurityCode: payment.demoSecurityCode, demoVerificationCode, amountQar: cartTotal(cart) }); setNotice("تم إرسال الطلب. بانتظار قبول أو رفض الإدارة."); setAwaitingDecision(true); }
    catch (caught) { console.error("[Sandbox payment submit]", caught); setError("تعذر إرسال الطلب مؤقتًا. حاولي مرة أخرى."); setIsSubmitting(false); }
  };
  return <><CheckoutHeader active={2} /><main className="container flex min-h-[610px] items-center justify-center py-12"><form onSubmit={submit} className="w-full max-w-[560px] text-center"><span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Smartphone size={26} /></span><div className="eyebrow mb-3 text-[#8d2430]">VERIFY / ٠٣</div><h1 className="display-serif text-5xl sm:text-6xl">كود التحقق<br /><em className="font-normal text-[#8d2430]">الآمن.</em></h1><p className="mx-auto mt-5 max-w-[430px] text-sm leading-7 text-[#746c64]">أدخلي كود التحقق المرسل إليك لتأكيد عملية الدفع.</p><div className="mx-auto my-9 flex max-w-[430px] justify-center gap-2 sm:gap-3" dir="ltr">{code.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} value={digit} disabled={awaitingDecision} onChange={(event) => update(index, event.target.value)} inputMode="numeric" maxLength={1} aria-label={`رقم ${index + 1} من كود التحقق`} className="h-14 w-11 border border-[#d8cbbf] bg-[#fbf8f4] !text-center text-xl font-semibold outline-none focus:border-[#8d2430] disabled:opacity-60 sm:h-16 sm:w-14" />)}</div>{error && <p className="mb-5 text-sm text-[#8d2430]">{error}</p>}{notice && <p className="mb-5 text-sm font-semibold text-emerald-700">{notice}</p>}<button disabled={isSubmitting} className="pill-button w-full max-w-[430px] gap-3 bg-[#252220] px-8 py-4 text-sm font-semibold text-white hover:bg-[#8d2430] disabled:opacity-75">{awaitingDecision ? <><LoaderCircle size={17} className="animate-spin" /> بانتظار قرار الإدارة</> : isSubmitting ? <><LoaderCircle size={17} className="animate-spin" /> جارٍ التحقق</> : <>تأكيد <Check size={17} /></>}</button></form></main></>;
}

function SuccessStep() { return <><CheckoutHeader active={3} /><main className="container flex min-h-[610px] items-center justify-center py-12"><div className="max-w-[580px] text-center"><span className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#8d2430] text-white"><Check size={34} /></span><div className="eyebrow mb-3 text-[#8d2430]">ORDER CONFIRMED / ٠٤</div><h1 className="display-serif text-6xl">تمت العملية<br /><em className="font-normal text-[#8d2430]">بنجاح.</em></h1><p className="mx-auto mt-5 max-w-[410px] text-sm leading-7 text-[#746c64]">شكرًا لاختيارك Qatar Curves، سنكون سعداء بخدمتك.</p><Link href="/" className="pill-button mt-8 gap-3 bg-[#252220] px-8 py-3 text-sm font-semibold text-white hover:bg-[#8d2430]">العودة للمتجر <ArrowLeft size={17} /></Link></div></main></>; }

export default function CheckoutPage() {
  const [, address] = useRoute("/checkout/address"); const [, payment] = useRoute("/checkout/payment"); const [, verify] = useRoute("/checkout/verify");
  if (address) return <AddressStep />; if (payment) return <PaymentStep />; if (verify) return <VerifyStep />; return <SuccessStep />;
}
