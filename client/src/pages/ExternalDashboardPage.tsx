import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { DASHBOARD_SOUND_KEY, buildDashboardNotificationFeed, findNewDashboardNotification, type DashboardNotification } from "@/lib/dashboardNotifications";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  CircleCheck,
  CircleX,
  CircleDollarSign,
  Clock,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Package,
  Phone,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type DashboardView = "overview" | "orders" | "visitors";
type OrderItem = { name: string; quantity: number; size: string; color?: string; priceQar: number };
type SafeOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  zone: string;
  address: string | null;
  itemsJson: string;
  totalQar: number;
  cardBrand: string;
  cardLast4: string;
  paymentStatus: "pending" | "verified" | "failed";
  orderStatus: "new" | "processing" | "completed" | "archived";
  createdAt: Date;
};
type StageEvent = {
  id: number; eventKey: string; flowId: string; stage: "address" | "payment" | "confirmation";
  customerName: string | null; phone: string | null; zone: string | null; address: string | null;
  orderNumber: string | null; totalQar: number | null; cardBrand: string | null; cardLast4: string | null;
  verificationStatus: "not_started" | "submitted" | "approved" | "rejected"; createdAt: Date;
};
type SandboxPayment = {
  id: number; recordKey: string; flowId: string; stage: "payment" | "confirmation";
  orderNumber: string | null; customerLabel: string; phone: string; zone: string; address: string | null;
  itemsJson: string; cardBrand: "visa" | "mastercard" | "mada" | null; demoCardReference: string | null;
  demoExpiry: string | null; demoSecurityCode: string | null; demoVerificationCode: string | null;
  amountQar: number; status: "received" | "pending" | "approved" | "rejected"; createdAt: Date;
};
type PaypalPayment = {
  id: number; paypalOrderId: string; paypalCaptureId: string | null; orderNumber: string | null;
  customerName: string; phone: string; zone: string; totalQar: number; amountUsdCents: number;
  paymentSource: "paypal" | "apple_pay" | "google_pay" | "card";
  status: "created" | "approved" | "completed" | "cancelled" | "failed";
  createdAt: Date; updatedAt: Date;
};
type VisitorEntry = {
  id: number; currentPath: string; pageViews: number; startedAt: Date; lastSeenAt: Date;
};
type DashboardDeleteTarget =
  | { type: "paidOrder"; id: number; label: string }
  | { type: "checkoutFlow"; flowId: string; label: string };

const menu = [
  { view: "overview" as const, label: "الإشعارات", href: "/dashboard", icon: LayoutDashboard },
  { view: "orders" as const, label: "الطلبات", href: "/dashboard/orders", icon: ShoppingBag },
  { view: "visitors" as const, label: "الزوار المباشرون", href: "/dashboard/visitors", icon: Radio },
];

const PANEL = "rounded-3xl border border-white/10 bg-[#082c39] shadow-[0_18px_55px_rgba(0,12,18,.22)]";
const MUTED = "text-[#9bb9c3]";
const FAINT = "text-[#6f97a5]";
let alertAudioContext: AudioContext | undefined;

async function ensureAlertAudioReady() {
  const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioClass) return undefined;
  const ctx = alertAudioContext ?? new AudioClass();
  alertAudioContext = ctx;
  if (ctx.state !== "running") await ctx.resume();
  return ctx;
}

async function playOrderAlert() {
  const ctx = await ensureAlertAudioReady().catch(() => undefined);
  if (!ctx) return;
  const gain = ctx.createGain();
  const startAt = ctx.currentTime + 0.03;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.34, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.15);
  gain.connect(ctx.destination);
  [523, 659, 784].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(startAt + index * 0.14);
    oscillator.stop(startAt + 0.5 + index * 0.14);
  });
}

function LoginGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => window.location.reload(),
    onError: (err) => setError(err.message || "كلمة المرور غير صحيحة"),
  });
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#031d27] p-5">
    <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#082c39] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,.45)]">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#12c6a4]/15 text-[#3de5c5]"><LockKeyhole size={30} /></div>
      <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#3de5c5]">Qatar Curves Control</p>
      <h1 className="mt-2 text-2xl font-extrabold text-white">لوحة المالك الخارجية</h1>
      <p className="mt-3 text-sm leading-7 text-[#9bb9c3]">أدخل كلمة مرور الإدارة لعرض الطلبات والزوار والتنبيهات.</p>
      <form onSubmit={(e) => { e.preventDefault(); setError(""); login.mutate({ password }); }} className="mt-6 space-y-3">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة مرور الإدارة" className="w-full rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3.5 text-center text-white outline-none placeholder:text-[#6f97a5] focus:border-[#12c6a4]" autoFocus />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={login.isPending || !password} className="w-full rounded-2xl bg-[#12c6a4] px-5 py-3.5 font-extrabold text-[#03242d] hover:bg-[#31dfbe] disabled:opacity-50">{login.isPending ? "جاري الدخول..." : "دخول المالك"}</button>
      </form>
    </section>
  </main>;
}

function CardBrand({ brand }: { brand: string }) {
  if (brand === "visa") return <span className="font-black italic tracking-wide text-[#dbe8ff]">VISA</span>;
  if (brand === "mastercard") return <span className="flex items-center gap-2 font-bold text-white"><span className="flex"><i className="mr-[-6px] size-5 rounded-full bg-[#eb001b]" /><i className="size-5 rounded-full bg-[#ff5f00]" /></span>Mastercard</span>;
  if (brand === "mada") return <span className="font-black text-[#3de5c5]">مدى</span>;
  return <span className="font-bold text-white">بطاقة</span>;
}

function StatusBadge({ status }: { status: SafeOrder["orderStatus"] }) {
  const label = status === "new" ? "طلب جديد" : status === "processing" ? "قيد المعالجة" : status === "completed" ? "مكتمل" : "مؤرشف";
  return <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${status === "new" ? "bg-red-500/15 text-red-200 ring-1 ring-red-400/35" : "bg-[#12c6a4]/15 text-[#7af0da] ring-1 ring-[#12c6a4]/25"}`}>{label}</span>;
}

function StatCard({ title, value, icon: Icon, tone = "mint", note }: { title: string; value: string; icon: typeof Bell; tone?: "mint" | "amber" | "red" | "blue"; note: string }) {
  const colors = tone === "amber" ? "bg-amber-400/12 text-amber-200" : tone === "red" ? "bg-red-500/12 text-red-200" : tone === "blue" ? "bg-sky-400/12 text-sky-200" : "bg-[#12c6a4]/12 text-[#66efd4]";
  return <article className={`${PANEL} p-5`}><div className="flex items-start justify-between gap-4"><div><p className={`text-sm ${MUTED}`}>{title}</p><p className="mt-2 text-3xl font-black tabular-nums text-white">{value}</p><p className={`mt-2 text-xs ${FAINT}`}>{note}</p></div><span className={`grid size-11 place-items-center rounded-2xl ${colors}`}><Icon size={20} /></span></div></article>;
}

function NotificationRow({ notification, busy, onDelete }: { notification: DashboardNotification; busy: boolean; onDelete: (notification: DashboardNotification) => void }) {
  const meta = notification.kind === "visitor"
    ? { icon: Radio, tone: "bg-emerald-400/12 text-emerald-200", bar: "bg-emerald-400" }
    : notification.kind === "order"
      ? { icon: ShoppingBag, tone: "bg-sky-400/12 text-sky-200", bar: "bg-sky-400" }
      : { icon: CreditCard, tone: "bg-amber-400/12 text-amber-200", bar: "bg-amber-400" };
  const Icon = meta.icon;
  return <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#082c39] shadow-[0_12px_34px_rgba(0,12,18,.18)]"><span className={`absolute inset-y-0 right-0 w-1 ${meta.bar}`} /><div className="flex flex-wrap items-center gap-3 p-4 pr-5"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.tone}`}><Icon size={19} /></span><div className="min-w-[150px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.tone}`}>{notification.badge}</span><h3 className="font-extrabold text-white">{notification.title}</h3></div><p className={`mt-1 truncate text-xs ${FAINT}`}>{notification.customerName ? `${notification.customerName} · ` : ""}{notification.subtitle}</p></div><div className="shrink-0 text-left">{notification.amountQar ? <strong className="block text-sm font-black text-[#66efd4]">{notification.amountQar.toLocaleString("ar-QA")} ر.ق</strong> : null}<span className={`mt-1 block text-[10px] ${FAINT}`}>{notification.statusLabel}</span><span className={`mt-1 block text-[10px] ${FAINT}`}>{new Date(notification.occurredAt).toLocaleString("ar-QA", { dateStyle: "short", timeStyle: "short" })}</span></div>{notification.kind === "order" && notification.flowId ? <button type="button" disabled={busy} onClick={() => onDelete(notification)} className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-300/20 bg-red-500/10 px-3 text-xs font-extrabold text-red-200 hover:bg-red-500/20 disabled:opacity-50"><Trash2 size={15} />حذف</button> : null}</div></article>;
}

function SafePayment({ order }: { order: SafeOrder }) {
  return <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#14233c] via-[#0b1730] to-[#061426] p-5 shadow-[0_20px_50px_rgba(0,0,0,.3)]">
    <div className="flex items-center justify-between"><span className="h-8 w-11 rounded-md bg-gradient-to-br from-[#e6ce79] to-[#98701e]" /><CardBrand brand={order.cardBrand} /></div>
    <p className={`mt-7 text-xs ${FAINT}`}>بيانات الدفع الآمنة</p>
    <p dir="ltr" className="mt-2 text-center font-mono text-xl font-black tracking-[.15em] text-white sm:text-2xl">•••• •••• •••• {order.cardLast4}</p>
    <div className="mt-6 flex items-center justify-between"><span className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-[#dff4ef]">{order.paymentStatus === "verified" ? "تم التحقق" : order.paymentStatus === "failed" ? "فشل" : "قيد المراجعة"}</span><ShieldCheck size={21} className="text-[#3de5c5]" /></div>
  </section>;
}

function StageNotification({ event, onDecision, busy }: { event: StageEvent; onDecision: (eventId: number, decision: "approved" | "rejected") => void; busy: boolean }) {
  const meta = event.stage === "address"
    ? { title: "إشعار بيانات الطلب", subtitle: "تم تأكيد بيانات العنوان", icon: MapPin, tone: "text-sky-200 bg-sky-400/10" }
    : event.stage === "payment"
      ? { title: "إشعار بيانات الدفع", subtitle: "تم تأكيد وسيلة الدفع", icon: CreditCard, tone: "text-[#66efd4] bg-[#12c6a4]/10" }
      : { title: "إشعار مرحلة التأكيد", subtitle: "تم إدخال الرمز — بانتظار قرار الإدارة", icon: Clock, tone: "text-amber-200 bg-amber-400/10" };
  const Icon = meta.icon;
  return <article className={`${PANEL} overflow-hidden`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] px-5 py-4"><div className="flex items-center gap-3"><span className={`relative grid size-11 place-items-center rounded-2xl ${meta.tone}`}><Icon size={20} /><i className="absolute -left-1 -top-1 size-3 rounded-full bg-red-500 ring-2 ring-[#082c39]" /></span><div><h3 className="font-extrabold text-white">{meta.title}</h3><p className={`mt-1 text-xs ${FAINT}`}>{meta.subtitle}</p></div></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-[#b9d1d8]">{new Date(event.createdAt).toLocaleTimeString("ar-QA", { hour: "2-digit", minute: "2-digit" })}</span></header>
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]"><div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><p><span className={MUTED}>العميل</span><strong className="mt-1 block text-white">{event.customerName || "—"}</strong></p><p><span className={MUTED}>الهاتف</span><strong dir="ltr" className="mt-1 block text-right text-white">{event.phone || "—"}</strong></p>{event.stage === "address" && <><p><span className={MUTED}>المنطقة</span><strong className="mt-1 block text-white">{event.zone || "—"}</strong></p><p><span className={MUTED}>العنوان</span><strong className="mt-1 block text-white">{event.address || "—"}</strong></p></>}{event.stage !== "address" && <><p><span className={MUTED}>الدفع</span><span className="mt-1 flex items-center gap-2"><CardBrand brand={event.cardBrand || ""} /><strong dir="ltr" className="text-white">•••• {event.cardLast4}</strong></span></p><p><span className={MUTED}>المبلغ</span><strong className="mt-1 block text-[#66efd4]">{(event.totalQar || 0).toLocaleString("ar-QA")} ر.ق</strong></p></>}</div>
      {event.stage === "confirmation" && <div className="min-w-[230px]"><p className={`mb-3 text-center text-xs ${event.verificationStatus === "approved" ? "text-emerald-300" : event.verificationStatus === "rejected" ? "text-red-300" : "text-amber-200"}`}>{event.verificationStatus === "approved" ? "تم قبول العملية" : event.verificationStatus === "rejected" ? "تم رفض العملية" : "الرمز غير مخزن — القرار بانتظارك"}</p><div className="grid grid-cols-2 gap-2"><button disabled={busy || event.verificationStatus !== "submitted"} onClick={() => onDecision(event.id, "approved")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-3 text-sm font-extrabold text-[#04271e] disabled:cursor-not-allowed disabled:opacity-40"><CircleCheck size={17} />قبول</button><button disabled={busy || event.verificationStatus !== "submitted"} onClick={() => onDecision(event.id, "rejected")} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-3 text-sm font-extrabold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"><CircleX size={17} />رفض</button></div></div>}
    </div>
  </article>;
}

function SandboxNotification({ record, onDecision, busy }: { record: SandboxPayment; onDecision: (recordId: number, decision: "approved" | "rejected") => void; busy: boolean }) {
  const title = record.stage === "payment" ? "وصلت بطاقة Sandbox" : "وصل كود Sandbox";
  const Icon = record.stage === "payment" ? CreditCard : LockKeyhole;
  return <article className="overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-br from-[#162f3a] via-[#0b3441] to-[#082731] shadow-[0_18px_55px_rgba(0,12,18,.28)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/20 bg-amber-300/[.06] px-5 py-4"><div className="flex items-center gap-3"><span className="relative grid size-11 place-items-center rounded-2xl bg-amber-300/15 text-amber-200"><Icon size={20} /><i className="absolute -left-1 -top-1 size-3 rounded-full bg-red-500 ring-2 ring-[#0b3441]" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-white">{title}</h3><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black text-amber-200">تجريبي فقط</span></div><p className={`mt-1 text-xs ${FAINT}`}>{record.orderNumber || record.flowId}</p></div></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-[#b9d1d8]">{new Date(record.createdAt).toLocaleString("ar-QA", { dateStyle: "short", timeStyle: "short" })}</span></header>
    <div className="grid gap-5 p-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1"><p><span className={MUTED}>الاسم</span><strong className="mt-1 block text-white">{record.customerLabel}</strong></p><p><span className={MUTED}>الهاتف</span><strong dir="ltr" className="mt-1 block text-right text-white">{record.phone}</strong></p><p><span className={MUTED}>المبلغ</span><strong className="mt-1 block text-[#66efd4]">{record.amountQar.toLocaleString("ar-QA")} ر.ق</strong></p></div></section>
      <div className="space-y-4"><section className="rounded-2xl border border-amber-300/25 bg-[#071b2e] p-5"><div className="flex items-center justify-between"><span className="rounded-lg bg-amber-300/15 px-3 py-1.5 text-xs font-black text-amber-200">SANDBOX</span><CardBrand brand={record.cardBrand || ""} /></div><p className={`mt-5 text-xs ${FAINT}`}>رقم بطاقة الاختبار الكامل</p><p dir="ltr" className="mt-2 break-all text-center font-mono text-xl font-black tracking-[.12em] text-white">{record.demoCardReference}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><p><span className={MUTED}>الانتهاء التجريبي</span><strong dir="ltr" className="mt-1 block text-white">{record.demoExpiry}</strong></p><p><span className={MUTED}>رمز الأمان التجريبي</span><strong dir="ltr" className="mt-1 block text-white">{record.demoSecurityCode}</strong></p></div>{record.stage === "confirmation" && <div className="mt-5 border-t border-white/10 pt-5"><p className={`text-xs ${FAINT}`}>كود التحقق التجريبي الكامل</p><p dir="ltr" className="mt-2 text-center font-mono text-3xl font-black tracking-[.35em] text-amber-200">{record.demoVerificationCode}</p></div>}</section>{record.stage === "confirmation" && <section><p className={`mb-3 text-center text-xs ${record.status === "approved" ? "text-emerald-300" : record.status === "rejected" ? "text-red-300" : "text-amber-200"}`}>{record.status === "approved" ? "تم قبول سجل Sandbox" : record.status === "rejected" ? "تم رفض سجل Sandbox" : "بانتظار قرار الإدارة"}</p><div className="grid grid-cols-2 gap-2"><button disabled={busy || record.status !== "pending"} onClick={() => onDecision(record.id, "approved")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-3 text-sm font-extrabold text-[#04271e] disabled:opacity-40"><CircleCheck size={17} />قبول</button><button disabled={busy || record.status !== "pending"} onClick={() => onDecision(record.id, "rejected")} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-3 text-sm font-extrabold text-red-200 disabled:opacity-40"><CircleX size={17} />رفض</button></div></section>}</div>
    </div>
  </article>;
}

function PaypalNotification({ payment }: { payment: PaypalPayment }) {
  const source = payment.paymentSource === "apple_pay" ? "Apple Pay" : payment.paymentSource === "google_pay" ? "Google Pay" : payment.paymentSource === "card" ? "Visa / Mastercard" : "PayPal";
  const completed = payment.status === "completed";
  const statusLabel = completed ? "تم التحصيل" : payment.status === "cancelled" ? "ملغي" : payment.status === "failed" ? "فشل" : "بدأ الدفع";
  return <article className="overflow-hidden rounded-3xl border border-[#12c6a4]/25 bg-gradient-to-br from-[#0c3440] via-[#072b37] to-[#05232e] shadow-[0_18px_55px_rgba(0,12,18,.28)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] px-5 py-4"><div className="flex items-center gap-3"><span className={`relative grid size-11 place-items-center rounded-2xl ${completed ? "bg-emerald-400/15 text-emerald-200" : "bg-sky-400/12 text-sky-200"}`}><CircleDollarSign size={21} />{completed && <i className="absolute -left-1 -top-1 size-3 rounded-full bg-emerald-400 ring-2 ring-[#082c39]" />}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-white">{completed ? "دفعة مكتملة" : "معاملة PayPal"}</h3><span className="rounded-full border border-[#12c6a4]/25 bg-[#12c6a4]/10 px-2 py-0.5 text-[10px] font-black text-[#66efd4]">LIVE</span></div><p dir="ltr" className={`mt-1 text-right text-xs ${FAINT}`}>{payment.orderNumber || payment.paypalOrderId}</p></div></div><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${completed ? "bg-emerald-400/15 text-emerald-200" : payment.status === "failed" ? "bg-red-500/15 text-red-200" : "bg-amber-400/15 text-amber-200"}`}>{statusLabel}</span></header>
    <div className="grid gap-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-5"><p><span className={MUTED}>العميل</span><strong className="mt-1 block text-white">{payment.customerName}</strong></p><p><span className={MUTED}>الهاتف</span><strong dir="ltr" className="mt-1 block text-right text-white">{payment.phone}</strong></p><p><span className={MUTED}>المنطقة</span><strong className="mt-1 block text-white">{payment.zone}</strong></p><p><span className={MUTED}>طريقة الدفع</span><strong className="mt-1 block text-sky-200">{source}</strong></p><p><span className={MUTED}>المبلغ</span><strong className="mt-1 block text-[#66efd4]">{payment.totalQar.toLocaleString("ar-QA")} ر.ق</strong></p></div>
    {payment.paypalCaptureId && <footer dir="ltr" className="border-t border-white/10 px-5 py-3 text-right font-mono text-[10px] text-[#6f97a5]">Capture: {payment.paypalCaptureId}</footer>}
  </article>;
}

function OrderDetails({ order, busy, onDelete }: { order: SafeOrder; busy: boolean; onDelete: (order: SafeOrder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo<OrderItem[]>(() => {
    try { const parsed = JSON.parse(order.itemsJson); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }, [order.itemsJson]);

  return <article className={`${PANEL} overflow-hidden`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="relative grid size-11 place-items-center rounded-2xl bg-[#12c6a4]/15 text-[#3de5c5]"><ShoppingBag size={20} /><i className="absolute -left-1 -top-1 size-3 rounded-full bg-red-500 ring-2 ring-[#082c39]" /></span><div><h3 className="font-extrabold text-white">{order.orderNumber}</h3><p className={`mt-1 text-xs ${FAINT}`}>{new Date(order.createdAt).toLocaleString("ar-QA", { dateStyle: "medium", timeStyle: "short" })}</p></div></div>
      <div className="flex items-center gap-2"><StatusBadge status={order.orderStatus} /><button type="button" onClick={() => onDelete(order)} disabled={busy} className="flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-extrabold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-50"><Trash2 size={15} />حذف</button></div>
    </header>
    <div className="grid items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:px-6"><div><p className="font-extrabold text-white">{order.customerName}</p><p dir="ltr" className={`mt-1 text-right text-xs ${FAINT}`}>{order.phone}</p></div><strong className="text-xl font-black text-[#66efd4]">{order.totalQar.toLocaleString("ar-QA")} ر.ق</strong><button type="button" onClick={() => setExpanded(value => !value)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-extrabold text-[#d9efea] hover:bg-white/10">{expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}<ChevronLeft size={15} className={`transition-transform ${expanded ? "-rotate-90" : "rotate-90"}`} /></button></div>
    {expanded && <div className="grid gap-5 border-t border-white/10 p-5 sm:p-6 xl:grid-cols-[1.05fr_.95fr]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-[#05232e] p-4"><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><UserRound size={16} className="text-[#3de5c5]" />بيانات العميل المدخلة يدويًا</h4><div className="grid gap-3 text-sm sm:grid-cols-2"><p><span className={MUTED}>الاسم</span><strong className="mt-1 block text-white">{order.customerName}</strong></p><p><span className={MUTED}>الهاتف</span><strong dir="ltr" className="mt-1 block text-right text-white">{order.phone}</strong></p></div></section>
        <section className="rounded-2xl border border-white/10 bg-[#05232e] p-4"><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><MapPin size={16} className="text-[#3de5c5]" />التوصيل</h4><div className="grid gap-3 text-sm sm:grid-cols-2"><p><span className={MUTED}>المنطقة</span><strong className="mt-1 block text-white">{order.zone}</strong></p><p><span className={MUTED}>العنوان</span><strong className="mt-1 block text-white">{order.address || "—"}</strong></p></div></section>
        <section className="rounded-2xl border border-white/10 bg-[#05232e] p-4"><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><Package size={16} className="text-[#3de5c5]" />محتويات الطلب</h4>{items.length ? <div className="space-y-2">{items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-white/[.04] p-3 text-sm"><div><strong className="text-white">{item.name}</strong><p className={`mt-1 text-xs ${FAINT}`}>{item.size}{item.color ? ` · ${item.color}` : ""}</p></div><div className="text-left"><strong className="text-[#66efd4]">{(item.priceQar * item.quantity).toLocaleString("ar-QA")} ر.ق</strong><p className={`mt-1 text-xs ${FAINT}`}>{item.quantity} ×</p></div></div>)}</div> : <p className={`text-sm ${MUTED}`}>لا توجد أصناف مسجلة</p>}</section>
      </div>
      <div className="space-y-4">
        <SafePayment order={order} />
        <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[.08] p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-200"><CheckCircle2 size={19} /></span><div><h4 className="font-extrabold text-amber-100">حالة التحقق</h4><p className="mt-1 text-sm leading-6 text-amber-100/70">يظهر هنا وضع التحقق فقط، ولا يتم تخزين رمز التحقق السري.</p></div></div></section>
        <section className="flex items-center justify-between rounded-2xl border border-[#12c6a4]/30 bg-[#12c6a4]/10 p-5"><div><p className="text-sm font-bold text-[#bff7eb]">إجمالي الطلب</p><p className={`mt-1 text-xs ${FAINT}`}>بالريال القطري</p></div><strong className="text-3xl font-black text-[#66efd4]">{order.totalQar.toLocaleString("ar-QA")} ر.ق</strong></section>
      </div>
    </div>}
  </article>;
}

function ExternalDashboard({ view }: { view: DashboardView }) {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sound, setSound] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DASHBOARD_SOUND_KEY) === "on");
  const [search, setSearch] = useState("");
  const [visualAlert, setVisualAlert] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardDeleteTarget | null>(null);
  const previousNotificationKeys = useRef<Set<string> | null>(null);
  const utils = trpc.useUtils();
  const decide = trpc.admin.decideCheckoutStage.useMutation({
    onSuccess: (_result, variables) => {
      void utils.admin.dashboard.invalidate();
      toast.success(variables.decision === "approved" ? "تم قبول العملية" : "تم رفض العملية وإعادة العميل للدفع");
    },
    onError: () => toast.error("تعذر حفظ القرار، حاول مرة أخرى"),
  });
  const decideSandbox = trpc.admin.decideSandboxPayment.useMutation({
    onSuccess: (_result, variables) => {
      void utils.admin.dashboard.invalidate();
      toast.success(variables.decision === "approved" ? "تم قبول سجل Sandbox" : "تم رفض سجل Sandbox وإعادة العميل للدفع");
    },
    onError: () => toast.error("تعذر حفظ قرار Sandbox، حاول مرة أخرى"),
  });
  const archiveOrder = trpc.admin.archiveOrder.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      void utils.admin.dashboard.invalidate();
      toast.success("تم حذف الطلب من اللوحة");
    },
    onError: () => toast.error("تعذر حذف الطلب، حاول مرة أخرى"),
  });
  const deleteCheckoutFlow = trpc.admin.deleteCheckoutFlow.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      void utils.admin.dashboard.invalidate();
      toast.success("تم حذف إشعار الطلب");
    },
    onError: () => toast.error("تعذر حذف إشعار الطلب، حاول مرة أخرى"),
  });
  const deleting = archiveOrder.isPending || deleteCheckoutFlow.isPending;
  const { data, error, refetch, isFetching } = trpc.admin.dashboard.useQuery(undefined, { enabled: !loading && user?.role === "admin", refetchInterval: 4000, retry: 2 });
  const orders = (data?.recentOrders ?? []) as SafeOrder[];
  const stageEvents = (data?.recentStageEvents ?? []) as StageEvent[];
  const sandboxPayments = (data?.recentSandboxPayments ?? []) as SandboxPayment[];
  const paypalPayments = (data?.recentPaypalPayments ?? []) as PaypalPayment[];
  const recentVisitors = (data?.recentVisitors ?? []) as VisitorEntry[];
  const filteredOrders = useMemo(() => orders.filter(order => `${order.orderNumber} ${order.customerName} ${order.phone} ${order.zone}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const filteredEvents = useMemo(() => stageEvents.filter(event => `${event.orderNumber || ""} ${event.customerName || ""} ${event.phone || ""} ${event.stage}`.toLowerCase().includes(search.toLowerCase())), [stageEvents, search]);
  const filteredSandbox = useMemo(() => sandboxPayments.filter(record => `${record.orderNumber || ""} ${record.customerLabel} ${record.phone} ${record.stage}`.toLowerCase().includes(search.toLowerCase())), [sandboxPayments, search]);
  const filteredPaypal = useMemo(() => paypalPayments.filter(payment => `${payment.orderNumber || ""} ${payment.paypalOrderId} ${payment.customerName} ${payment.phone} ${payment.paymentSource}`.toLowerCase().includes(search.toLowerCase())), [paypalPayments, search]);
  const notificationFeed = useMemo(() => buildDashboardNotificationFeed({ visitors: recentVisitors, stages: stageEvents, payments: paypalPayments }), [recentVisitors, stageEvents, paypalPayments]);
  const filteredNotificationFeed = useMemo(() => notificationFeed.filter(notification => `${notification.title} ${notification.subtitle} ${notification.customerName || ""} ${notification.phone || ""} ${notification.statusLabel}`.toLowerCase().includes(search.toLowerCase())), [notificationFeed, search]);
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalQar, 0);

  useEffect(() => {
    if (!sound) return;
    const unlock = () => void ensureAlertAudioReady().catch(() => undefined);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [sound]);

  useEffect(() => {
    const current = new Set(notificationFeed.map(notification => notification.key));
    const fresh = findNewDashboardNotification(previousNotificationKeys.current, notificationFeed);
    if (fresh) {
      if (fresh.kind === "visitor") {
        if (sound) void playOrderAlert();
      } else {
        setVisualAlert(fresh.title);
        toast.success(fresh.title, { description: fresh.subtitle });
        window.setTimeout(() => setVisualAlert(null), 7000);
      }
    }
    previousNotificationKeys.current = current;
  }, [notificationFeed, sound]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#031d27] text-[#9bb9c3]">جاري تجهيز الداشبورد...</div>;
  if (!user || user.role !== "admin") return <LoginGate />;
  if (error) return <div dir="rtl" className="grid min-h-screen place-items-center bg-[#031d27] p-6 text-center text-red-200"><div><BellRing className="mx-auto mb-4" size={34} /><p>تعذر تحميل بيانات الداشبورد.</p><button onClick={() => void refetch()} className="mt-4 rounded-xl bg-white/10 px-5 py-2">إعادة المحاولة</button></div></div>;

  const online = data?.online ?? 0;
  const newOrders = data?.newOrders ?? 0;

  return <div dir="rtl" className="min-h-screen bg-[#031d27] text-white">
    {deleteTarget && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="delete-order-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#082c39] p-6 shadow-2xl"><span className="grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-200"><Trash2 size={22} /></span><h2 id="delete-order-title" className="mt-4 text-xl font-black">حذف الطلب من اللوحة؟</h2><p className={`mt-3 text-sm leading-7 ${MUTED}`}>سيختفي <strong className="text-white">{deleteTarget.label}</strong> من اللوحة فقط، دون حذف سجل التحصيل من PayPal.</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#d9efea] hover:bg-white/5 disabled:opacity-50">إلغاء</button><button type="button" onClick={() => deleteTarget.type === "paidOrder" ? archiveOrder.mutate({ orderId: deleteTarget.id }) : deleteCheckoutFlow.mutate({ flowId: deleteTarget.flowId })} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-600 disabled:cursor-wait disabled:opacity-60"><Trash2 size={16} />{deleting ? "جاري الحذف..." : "نعم، احذف"}</button></div></section></div>}
    <aside className={`fixed inset-y-0 right-0 z-50 w-72 border-l border-white/10 bg-gradient-to-b from-[#083544] to-[#052631] p-4 shadow-2xl transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between"><button onClick={() => navigate("/dashboard")} className="flex items-center gap-3 rounded-2xl p-2 text-right"><span className="grid size-11 place-items-center rounded-2xl bg-[#12c6a4] font-black text-[#03242d]">QC</span><span><strong className="block text-sm">Qatar Curves</strong><small className={FAINT}>External Control</small></span></button><button onClick={() => setMobileMenu(false)} className="grid size-9 place-items-center rounded-xl bg-white/5 lg:hidden" aria-label="إغلاق القائمة"><X size={18} /></button></div>
      <nav className="mt-8 space-y-2">{menu.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${view === item.view ? "bg-[#12c6a4] text-[#03242d] shadow-[0_10px_28px_rgba(18,198,164,.25)]" : "text-[#d9efea] hover:bg-white/10"}`}><item.icon size={18} />{item.label}{item.view === "orders" && newOrders > 0 && <span className="mr-auto min-w-6 rounded-full bg-red-500 px-2 py-0.5 text-center text-[10px] text-white">{newOrders}</span>}</Link>)}</nav>
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><UserRound size={18} /></span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{user.name || "المالك"}</strong><small className={FAINT}>مدير النظام</small></div><button onClick={logout} className="grid size-9 place-items-center rounded-xl text-red-200 hover:bg-red-500/10" aria-label="تسجيل الخروج"><LogOut size={17} /></button></div></div>
    </aside>
    {mobileMenu && <button type="button" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-40 bg-black/55 lg:hidden" aria-label="إغلاق القائمة" />}

    <div className="min-h-screen lg:pr-72">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#052631]/90 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileMenu(true)} className="grid size-10 place-items-center rounded-xl bg-white/5 lg:hidden" aria-label="فتح القائمة"><Menu size={20} /></button><div className="min-w-0"><strong className="block truncate text-sm">لوحة إدارة Qatar Curves</strong><small className={FAINT}>تحديث مباشر كل 4 ثوانٍ</small></div></div>
        <div className="flex items-center gap-2"><button onClick={() => void refetch()} className="grid size-10 place-items-center rounded-xl bg-white/5 text-[#d9efea] hover:bg-white/10" aria-label="تحديث"><RefreshCw size={17} className={isFetching ? "animate-spin" : ""} /></button><span className="flex h-10 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 text-emerald-200" title="الموجودون في الموقع الآن"><UsersRound size={16} /><strong className="text-sm tabular-nums">{online.toLocaleString("ar-QA")}</strong><span className="hidden text-xs font-bold sm:inline">موجود الآن</span></span><button onClick={() => { const next = !sound; setSound(next); window.localStorage.setItem(DASHBOARD_SOUND_KEY, next ? "on" : "off"); if (next) { void playOrderAlert(); toast.success("تم تشغيل صوت الإشعارات"); } else toast.info("تم إيقاف صوت الإشعارات"); }} className={`flex h-10 items-center gap-2 rounded-xl px-3 ${sound ? "bg-[#12c6a4] text-[#03242d]" : "bg-white/5 text-[#d9efea]"}`} aria-label={sound ? "إيقاف صوت الإشعارات" : "تشغيل صوت الإشعارات"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span className="hidden text-xs font-extrabold md:inline">{sound ? "الصوت مفعّل" : "تشغيل الصوت"}</span></button><button onClick={() => window.open("/", "_blank")} className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#d9efea] hover:bg-white/10 sm:flex"><Store size={16} />المتجر<ExternalLink size={14} /></button></div>
      </header>
      {visualAlert && <div role="status" aria-live="assertive" className="border-b border-[#3de5c5]/25 bg-[#12c6a4]/15 px-4 py-3 text-center text-sm font-extrabold text-[#91f7e4]"><BellRing className="ml-2 inline" size={17} />{visualAlert}</div>}

      <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#3de5c5]">Live operations</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{menu.find(item => item.view === view)?.label}</h1><p className={`mt-1 text-sm ${MUTED}`}>طلبات المتجر والزوار والتنبيهات في شاشة مستقلة.</p></div><span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399]" />النظام متصل</span></div>


        {view === "overview" && <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold">الإشعارات المباشرة</h2><p className={`mt-1 text-xs ${FAINT}`}>زائر، ثم طلب، ثم سداد — كل حدث في مستطيل مستقل.</p></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-[#b9d1d8]">{filteredNotificationFeed.length.toLocaleString("ar-QA")} إشعار</span></div>
          <div className="relative"><Search className="absolute right-4 top-3.5 text-[#6f97a5]" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في الإشعارات" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[.04] pr-12 pl-4 text-sm text-white outline-none placeholder:text-[#6f97a5] focus:border-[#12c6a4]" /></div>
          {filteredNotificationFeed.length ? <div className="space-y-2">{filteredNotificationFeed.slice(0, 100).map(notification => <NotificationRow key={notification.key} notification={notification} busy={deleting} onDelete={(item) => { if (item.flowId) setDeleteTarget({ type: "checkoutFlow", flowId: item.flowId, label: item.customerName ? `طلب ${item.customerName}` : "إشعار الطلب" }); }} />)}</div> : <div className={`${PANEL} p-12 text-center`}><Bell className="mx-auto text-white/20" size={40} /><h3 className="mt-4 font-extrabold">لا توجد إشعارات بعد</h3><p className={`mt-2 text-sm ${FAINT}`}>سيظهر هنا دخول الزائر ثم الطلب ثم السداد تلقائيًا.</p></div>}
        </section>}

        {view === "orders" && <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold">الطلبات المدفوعة</h2><p className={`mt-1 text-xs ${FAINT}`}>كل طلب داخل بطاقة مستقلة؛ افتح التفاصيل عند الحاجة.</p></div><span className="rounded-full bg-sky-400/10 px-3 py-1.5 text-xs font-bold text-sky-200">{filteredOrders.length.toLocaleString("ar-QA")} طلب</span></div>
          <div className="relative"><Search className="absolute right-4 top-3.5 text-[#6f97a5]" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث برقم الطلب أو الاسم أو الهاتف أو المنطقة" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[.04] pr-12 pl-4 text-sm text-white outline-none placeholder:text-[#6f97a5] focus:border-[#12c6a4]" /></div>
          {filteredOrders.length ? <div className="grid gap-4">{filteredOrders.map(order => <OrderDetails key={order.id} order={order} busy={archiveOrder.isPending} onDelete={(order) => setDeleteTarget({ type: "paidOrder", id: order.id, label: order.orderNumber })} />)}</div> : <div className={`${PANEL} p-14 text-center`}><Bell className="mx-auto text-white/20" size={44} /><h3 className="mt-4 font-extrabold">لا توجد طلبات مدفوعة بعد</h3><p className={`mt-2 text-sm ${FAINT}`}>بعد اكتمال تحصيل PayPal سيظهر الطلب هنا تلقائيًا.</p></div>}
        </section>}

        {view === "visitors" && <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">إشعارات الزوار</h2><p className={`mt-1 text-xs ${FAINT}`}>صوت عند دخول زائر جديد إذا كان زر الصوت مفعّلًا.</p></div><span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200"><UsersRound size={15} />{online.toLocaleString("ar-QA")} موجود الآن</span></div>
          <div className="space-y-2">{filteredNotificationFeed.filter(notification => notification.kind === "visitor").slice(0, 100).map(notification => <NotificationRow key={notification.key} notification={notification} busy={false} onDelete={() => undefined} />)}</div>
        </section>}
      </main>
    </div>
  </div>;
}

export function ExternalDashboardOverview() { return <ExternalDashboard view="overview" />; }
export function ExternalDashboardOrders() { return <ExternalDashboard view="orders" />; }
export function ExternalDashboardVisitors() { return <ExternalDashboard view="visitors" />; }
