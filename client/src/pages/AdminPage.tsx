import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { Activity, Bell, CheckCircle2, CreditCard, Inbox, LockKeyhole, MapPin, Package, Phone, Search, ShieldCheck, ShoppingBasket, Store, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type View = "overview" | "visitors" | "customers";
type OrderItem = { name: string; quantity: number; size: string; color?: string; priceQar: number };
type SafeOrder = {
  id: number; orderNumber: string; customerName: string; phone: string; zone: string; address: string | null;
  itemsJson: string; totalQar: number; cardBrand: string; cardLast4: string;
  paymentStatus: "pending" | "verified" | "failed"; orderStatus: "new" | "processing" | "completed" | "archived"; createdAt: Date;
};

const PANEL = "rounded-2xl border border-white/10 bg-[#072b38]";
const SUNKEN = "rounded-2xl border border-white/10 bg-[#05222e]";
const MUTED = "text-[#9fc0cb]";
const FAINT = "text-[#7ba3b1]";

function AccessDenied() {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#04202b] p-6"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#072b38] p-9 text-center shadow-2xl"><LockKeyhole className="mx-auto text-[#2ce0bd]" size={38} /><h1 className="mt-5 text-2xl font-extrabold text-white">دخول المالك فقط</h1><p className="mt-3 text-sm leading-7 text-[#9fc0cb]">سجّل الدخول بحساب مالك المشروع لفتح لوحة الإشعارات المرتبطة بالمتجر.</p><button onClick={startLogin} className="mt-7 w-full rounded-2xl bg-[#08b899] px-6 py-3 font-bold text-[#03222c] hover:bg-[#0ad0ac]">تسجيل دخول المالك</button></div></main>;
}

function playAlert() {
  const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioClass) return;
  const ctx = new AudioClass();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
  gain.connect(ctx.destination);
  [523, 659, 784].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(ctx.currentTime + index * 0.12);
    oscillator.stop(ctx.currentTime + 0.42 + index * 0.12);
  });
  window.setTimeout(() => ctx.close(), 1400);
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Bell; children: React.ReactNode }) {
  return <section className={`${SUNKEN} p-4`}><h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Icon className="size-4 text-[#2ce0bd]" />{title}</h4>{children}</section>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-2"><span className={`text-sm ${MUTED}`}>{label}</span><span className="min-w-0 truncate text-sm font-semibold text-white">{value}</span></div>;
}

function Brand({ name }: { name: string }) {
  if (name === "visa") return <span className="font-black italic text-white">VISA</span>;
  if (name === "mastercard") return <span className="flex items-center gap-2 font-bold text-white"><span className="flex"><i className="mr-[-5px] size-5 rounded-full bg-[#eb001b]" /><i className="size-5 rounded-full bg-[#ff5f00]" /></span>Mastercard</span>;
  if (name === "mada") return <span className="font-black text-[#2ce0bd]">مدى</span>;
  return <span className="text-white">بطاقة</span>;
}

function SafePaymentCard({ order }: { order: SafeOrder }) {
  return <div className="rounded-[1.4rem] bg-gradient-to-br from-[#14233c] via-[#0b1730] to-[#061426] p-6 shadow-[0_20px_40px_rgba(0,0,0,.35)]"><div className="flex items-center justify-between"><span className="h-8 w-11 rounded-md bg-gradient-to-br from-[#e3c66d] to-[#9f7b24]" /><Brand name={order.cardBrand} /></div><p className="mt-8 text-xs text-[#9fc0cb]">مرجع البطاقة المحمي</p><p dir="ltr" className="mt-2 text-center font-mono text-2xl font-black tracking-[0.16em] text-white">•••• •••• •••• {order.cardLast4}</p><div className="mt-7 flex items-end justify-between"><span className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-[#dff3ef]">{order.paymentStatus === "verified" ? "تم التحقق" : order.paymentStatus === "failed" ? "فشل" : "قيد المراجعة"}</span><ShieldCheck className="text-[#2ce0bd]" size={22} /></div></div>;
}

function OrderCard({ order }: { order: SafeOrder }) {
  const items = useMemo<OrderItem[]>(() => { try { const value = JSON.parse(order.itemsJson); return Array.isArray(value) ? value : []; } catch { return []; } }, [order.itemsJson]);
  return <article className={`${PANEL} overflow-hidden shadow-[0_18px_45px_rgba(2,16,22,.45)]`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#08b899]/20 text-[#2ce0bd]"><ShoppingBasket size={20} /></span><div><p className="flex items-center gap-2 font-extrabold text-white"><span className="size-2.5 rounded-full bg-red-500 ring-2 ring-red-300/30" />طلب جديد · {order.orderNumber}</p><p className={`mt-1 text-xs ${FAINT}`}>{new Date(order.createdAt).toLocaleString("ar-QA", { dateStyle: "medium", timeStyle: "short" })}</p></div></div><span className="rounded-full bg-[#08b899]/15 px-3 py-1.5 text-xs font-bold text-[#7ef0d8] ring-1 ring-[#08b899]/35">{order.orderStatus === "new" ? "جديد" : order.orderStatus}</span></header><div className="grid gap-4 p-5 lg:grid-cols-2"><div className="space-y-4"><Panel title="بيانات العميل" icon={Phone}><div className="divide-y divide-white/10"><InfoRow label="الاسم" value={order.customerName} /><InfoRow label="الجوال" value={order.phone} /></div></Panel><Panel title="بيانات التوصيل" icon={MapPin}><div className="divide-y divide-white/10"><InfoRow label="المنطقة" value={order.zone} /><InfoRow label="العنوان" value={order.address || "—"} /></div></Panel><Panel title="محتويات السلة" icon={ShoppingBasket}>{items.length ? <ul className="space-y-2">{items.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-3"><span dir="ltr" className="shrink-0 font-mono text-sm font-bold text-[#2ce0bd]">{item.quantity} ×</span><span className="min-w-0 flex-1 text-right text-sm text-[#dff3ef]">{item.name} · {item.size}{item.color ? ` · ${item.color}` : ""}</span><strong className="shrink-0 text-xs text-white">{(item.priceQar * item.quantity).toLocaleString("ar-QA")} ر.ق</strong></li>)}</ul> : <p className={`text-sm ${MUTED}`}>لا توجد أصناف مسجلة</p>}</Panel><div className="flex items-center justify-between rounded-2xl border border-[#08b899]/35 bg-[#08b899]/15 px-5 py-4"><span className="text-sm font-semibold text-[#c8f4ea]">الإجمالي</span><span className="text-2xl font-extrabold tabular-nums text-[#2ce0bd]">{order.totalQar.toLocaleString("ar-QA")} ر.ق</span></div></div><div className="space-y-4"><h4 className="flex items-center gap-2 text-sm font-bold text-white"><CreditCard className="size-4 text-[#2ce0bd]" />بيانات الدفع المحمية</h4><SafePaymentCard order={order} /><div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-5"><div className="flex items-center gap-3"><CheckCircle2 className="text-amber-300" size={22} /><div><h4 className="font-bold text-amber-100">حالة التحقق</h4><p className="mt-1 text-sm text-amber-100/75">تم استلام الطلب دون تخزين رمز التحقق أو رمز الأمان.</p></div></div></div></div></div></article>;
}

function AdminDashboard({ view }: { view: View }) {
  const { user, loading } = useAuth();
  const { data, error } = trpc.admin.dashboard.useQuery(undefined, { enabled: !loading && user?.role === "admin", refetchInterval: 4000, retry: false });
  const [sound, setSound] = useState(false);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  const previousIds = useRef<Set<number> | null>(null);
  const orders = (data?.recentOrders ?? []) as SafeOrder[];
  const filtered = useMemo(() => orders.filter(order => `${order.orderNumber} ${order.customerName} ${order.phone} ${order.zone}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);

  useEffect(() => {
    const current = new Set(orders.map(order => order.id));
    if (previousIds.current) {
      const fresh = orders.find(order => !previousIds.current?.has(order.id));
      if (fresh) {
        setAlert(`وصل طلب جديد: ${fresh.orderNumber}`);
        toast.success("وصل طلب جديد إلى لوحة الإشعارات", { description: fresh.customerName });
        if (sound) playAlert();
        window.setTimeout(() => setAlert(null), 6500);
      }
    }
    previousIds.current = current;
  }, [orders, sound]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#04202b] text-[#9fc0cb]">جاري تحميل لوحة الإشعارات...</div>;
  if (!user || user.role !== "admin") return <AccessDenied />;
  if (error) return <div dir="rtl" className="grid min-h-screen place-items-center bg-[#04202b] text-red-200">تعذر تحميل لوحة الإشعارات.</div>;

  const registrations = data?.recentRegistrations ?? [];
  const online = data?.online ?? 0;
  return <div dir="rtl" className="min-h-screen bg-[#04202b] text-white"><header className="sticky top-0 z-30 border-b border-white/10 bg-[#062733]/95 px-4 py-3 backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#08b899] font-black text-[#03222c]">QC</div><div><strong className="block text-sm">Qatar Curves Admin</strong><small className={FAINT}>تحديث مباشر للطلبات والزوار</small></div></div><nav className="flex flex-wrap items-center gap-2 text-xs font-bold"><Link href="/owner" className={`rounded-xl px-3 py-2 ${view === "overview" ? "bg-[#08b899] text-[#03222c]" : "bg-white/5 text-[#dff3ef]"}`}>الإشعارات</Link><Link href="/owner/customers" className={`rounded-xl px-3 py-2 ${view === "customers" ? "bg-[#08b899] text-[#03222c]" : "bg-white/5 text-[#dff3ef]"}`}>العملاء</Link><Link href="/owner/visitors" className={`rounded-xl px-3 py-2 ${view === "visitors" ? "bg-[#08b899] text-[#03222c]" : "bg-white/5 text-[#dff3ef]"}`}>الزوار</Link></nav><div className="flex items-center gap-2"><button onClick={() => { setSound(value => !value); if (!sound) playAlert(); }} className={`grid size-10 place-items-center rounded-xl ${sound ? "bg-[#08b899] text-[#03222c]" : "bg-white/5 text-[#dff3ef]"}`} aria-label="الصوت">{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button onClick={() => window.open("/", "_blank")} className="hidden items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#dff3ef] sm:flex"><Store size={16} />عرض المتجر</button></div></div></header>{alert && <div className="border-b border-[#2ce0bd]/30 bg-[#08b899]/20 px-5 py-3 text-center text-sm font-bold text-[#9affea]"><Bell className="ml-2 inline" size={16} />{alert}</div>}<main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-extrabold sm:text-3xl">لوحة الإشعارات</h1><p className={`mt-1 text-sm ${MUTED}`}>نفس نظام اللوحة المرفقة، مرتبط بطلبات وزوار Qatar Curves</p></div><div className="grid gap-4 sm:grid-cols-4"><div className={`${PANEL} p-5`}><p className={`text-sm ${MUTED}`}>طلبات جديدة</p><p className="mt-2 text-3xl font-extrabold text-[#2ce0bd]">{(data?.newOrders ?? 0).toLocaleString("ar-QA")}</p></div><div className={`${PANEL} p-5`}><p className={`text-sm ${MUTED}`}>كل التسجيلات</p><p className="mt-2 text-3xl font-extrabold text-[#2ce0bd]">{(data?.registrations ?? 0).toLocaleString("ar-QA")}</p></div><div className={`${PANEL} p-5`}><p className={`flex items-center gap-2 text-sm ${MUTED}`}><span className="relative flex size-2.5"><span className="absolute size-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative size-2.5 rounded-full bg-emerald-400" /></span>زوار الآن</p><p className="mt-2 text-3xl font-extrabold text-emerald-300">{online.toLocaleString("ar-QA")}</p></div><div className={`${PANEL} p-5`}><p className={`text-sm ${MUTED}`}>إجمالي الزوار</p><p className="mt-2 text-3xl font-extrabold text-[#2ce0bd]">{(data?.visitors ?? 0).toLocaleString("ar-QA")}</p></div></div>{view === "overview" && <><div className="relative"><Search className="absolute right-4 top-3.5 text-[#7ba3b1]" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="البحث برقم الطلب أو اسم العميل أو الهاتف" className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pr-12 pl-4 text-sm text-white outline-none placeholder:text-[#7ba3b1] focus:border-[#08b899]" /></div>{filtered.length ? <div className="space-y-6">{filtered.map(order => <OrderCard key={order.id} order={order} />)}</div> : <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center"><Bell className="mx-auto mb-3 text-white/25" size={42} /><p className="font-semibold">لا توجد طلبات جديدة</p><p className={`mt-1 text-xs ${FAINT}`}>سيظهر هنا كل طلب جديد تلقائيًا.</p></div>}</>}{view === "customers" && <div className={`${PANEL} overflow-hidden`}><div className="border-b border-white/10 px-5 py-4 font-bold">تسجيلات العملاء</div><div className="divide-y divide-white/10">{registrations.length ? registrations.map(customer => <div key={customer.id} className="grid gap-3 p-5 sm:grid-cols-4"><span className="font-bold">{customer.name}</span><span className={MUTED} dir="ltr">{customer.phone}</span><span className={MUTED}>{customer.zone}</span><span className={customer.isOnline ? "text-emerald-300" : FAINT}>{customer.isOnline ? "متصل الآن" : "غير متصل"}</span></div>) : <div className={`p-10 text-center ${MUTED}`}>لا توجد تسجيلات</div>}</div></div>}{view === "visitors" && <div className={`${PANEL} p-8 text-center`}><Activity className="mx-auto text-[#2ce0bd]" size={42} /><p className="mt-4 text-5xl font-extrabold text-emerald-300">{online.toLocaleString("ar-QA")}</p><p className={`mt-2 ${MUTED}`}>زائر متصل بالموقع الآن</p><p className={`mt-6 text-sm ${FAINT}`}>يتم تحديث حالة الزوار تلقائيًا كل 4 ثوانٍ.</p></div>}</main></div>;
}

export function AdminOverviewPage() { return <AdminDashboard view="overview" />; }
export function AdminVisitorsPage() { return <AdminDashboard view="visitors" />; }
export function AdminCustomersPage() { return <AdminDashboard view="customers" />; }
