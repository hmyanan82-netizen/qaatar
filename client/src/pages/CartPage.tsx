/* Qatar Curves — cart page keeps the editorial retail language while prioritizing a clear order summary and direct checkout path. */
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cartTotal, readCart, SALE_PERCENT, writeCart, type CartState } from "@/lib/cart";

const money = (value: number) => `${value.toLocaleString("ar-QA")} ر.ق`;

export default function CartPage() {
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartState>({ items: [] });

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener("qatar-cart-change", sync);
    return () => window.removeEventListener("qatar-cart-change", sync);
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    const next = { ...cart, items: cart.items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item) };
    setCart(next);
    writeCart(next);
  };

  const removeItem = (id: string) => {
    const next = { ...cart, items: cart.items.filter((item) => item.id !== id) };
    setCart(next);
    writeCart(next);
  };

  const clearVip = () => {
    const next = { ...cart, vip: undefined };
    setCart(next);
    writeCart(next);
  };

  const originalItemsTotal = cart.items.reduce((sum, item) => sum + (item.originalPriceQar ?? item.priceQar / (1 - SALE_PERCENT / 100)) * item.quantity, 0);
  const discountedItemsTotal = cart.items.reduce((sum, item) => sum + item.priceQar * item.quantity, 0);

  return <div dir="rtl" className="min-h-screen bg-[#f7f2ec] text-[#252220]">
    <div className="bg-[#252220] px-4 py-2 text-center text-[11px] font-medium tracking-[.16em] text-[#f7f2ec]">التوصيل مجاني داخل قطر <span className="mx-2 text-[#d8a5a8]">•</span> دفع تجريبي آمن</div>
    <header className="border-b border-[#d8cbbf]/70 bg-[#f7f2ec]"><div className="container flex h-[82px] items-center justify-between gap-4"><Link href="/" className="flex items-center gap-3"><img src="https://kwcurves.com/wp-content/uploads/2024/07/logo-curves.svg" alt="Curves logo" className="h-12 w-12 object-contain" /><span className="hidden sm:block"><span className="display-serif block text-[27px] leading-none">Qatar Curves</span><span className="mt-1 block text-[9px] tracking-[.24em] text-[#746c64]">SHAPE YOUR MOMENT</span></span></Link><Link href="/" className="text-xs font-semibold transition-colors hover:text-[#8d2430]">العودة للمتجر</Link></div></header>
    <main className="container py-10 lg:py-16"><div className="mb-10 flex items-end justify-between border-b border-[#d8cbbf] pb-6"><div><div className="eyebrow mb-2 text-[#8d2430]">QATAR CURVES / CART</div><h1 className="display-serif text-5xl sm:text-6xl">ملخص الطلب</h1></div><ShoppingBag className="hidden text-[#8d2430] sm:block" size={30} strokeWidth={1.3} /></div>
      {cart.items.length || cart.vip ? <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16"><section><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">المنتجات المختارة</h2><span className="text-xs text-[#746c64]">{cart.items.reduce((sum, item) => sum + item.quantity, 0)} قطعة</span></div><div className="border-y border-[#d8cbbf]">{cart.items.map((item) => <article key={item.id} className="flex gap-4 border-b border-[#d8cbbf] py-5 last:border-b-0"><Link href={`/product/${item.name.toLowerCase().replaceAll(" ", "-")}`} className="h-28 w-24 shrink-0 bg-[#ece1d6]"><img src={item.image} alt={item.name} className="h-full w-full object-contain" /></Link><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><Link href={`/product/${item.name.toLowerCase().replaceAll(" ", "-")}`} className="text-sm font-semibold hover:text-[#8d2430]">{item.name}</Link><p className="mt-2 text-xs leading-6 text-[#746c64]">المقاس: {item.size || "—"}<br />اللون: {item.color === "Beige" ? "بيج" : item.color === "Black" ? "أسود" : "كاكاو"}<br />العمر: {item.age} سنة</p></div><button type="button" onClick={() => removeItem(item.id)} aria-label={`حذف ${item.name}`} className="text-[#746c64] transition-colors hover:text-[#8d2430]"><Trash2 size={17} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center border border-[#d8cbbf] bg-[#fbf8f4]"><button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label="تقليل الكمية" className="p-2 hover:text-[#8d2430]"><Minus size={13} /></button><span className="min-w-8 text-center text-xs font-semibold">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label="زيادة الكمية" className="p-2 hover:text-[#8d2430]"><Plus size={13} /></button></div><div className="text-left"><del className="block text-xs text-[#8f857c]">{money((item.originalPriceQar ?? item.priceQar / (1 - SALE_PERCENT / 100)) * item.quantity)}</del><strong className="text-sm text-[#8d2430]">{money(item.priceQar * item.quantity)}</strong></div></div></div></article>)}{cart.vip && <article className="flex items-start justify-between gap-4 bg-[#ece1d6] px-4 py-5"><div><div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#8d2430]" /><h3 className="text-sm font-semibold">خدمة VIP</h3></div><p className="mt-2 text-xs leading-6 text-[#746c64]">{cart.vip.date} · {cart.vip.time}<br />المنطقة: {cart.vip.zone}</p></div><div className="flex items-center gap-4"><strong className="text-sm">{money(cart.vip.priceQar)}</strong><button type="button" onClick={clearVip} aria-label="حذف خدمة VIP" className="text-[#746c64] hover:text-[#8d2430]"><Trash2 size={17} /></button></div></article>}</div><Link href="/#bestsellers" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#746c64] hover:text-[#8d2430]"><ArrowLeft size={15} /> متابعة التسوق</Link></section><aside className="h-fit border border-[#d8cbbf] bg-[#ece1d6] p-6"><h2 className="display-serif mb-5 text-3xl">الإجمالي</h2><div className="space-y-4 border-b border-[#c9b9aa] pb-5 text-sm"><div className="flex justify-between"><span className="text-[#746c64]">السعر قبل الخصم</span><del className="text-[#8f857c]">{money(originalItemsTotal)}</del></div><div className="flex justify-between font-semibold text-[#8d2430]"><span>خصم {SALE_PERCENT}%</span><span>- {money(originalItemsTotal - discountedItemsTotal)}</span></div><div className="flex justify-between"><span className="text-[#746c64]">المنتجات بعد الخصم</span><span>{money(discountedItemsTotal)}</span></div>{cart.vip && <div className="flex justify-between"><span className="text-[#746c64]">خدمة VIP</span><span>{money(cart.vip.priceQar)}</span></div>}<div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#746c64]"><ChevronDown size={15} className="text-[#8d2430]" />التوصيل داخل قطر</span><span className="font-semibold text-[#8d2430]">مجاني</span></div></div><div className="flex items-center justify-between py-5 text-base font-semibold"><span>الإجمالي النهائي</span><span className="text-[#8d2430]">{money(cartTotal(cart))}</span></div><button type="button" onClick={() => navigate("/checkout/address")} className="w-full bg-[#252220] py-4 text-sm font-semibold text-white transition-colors hover:bg-[#8d2430]">المتابعة إلى الدفع <ArrowLeft size={17} className="mr-2 inline" /></button><p className="mt-4 text-center text-[11px] leading-5 text-[#746c64]">خصم {SALE_PERCENT}% · التوصيل مجاني داخل قطر · دفع تجريبي آمن</p></aside></div> : <div className="border-y border-[#d8cbbf] py-20 text-center"><ShoppingBag className="mx-auto mb-5 text-[#8d2430]" size={38} strokeWidth={1.2} /><h2 className="display-serif mb-3 text-4xl">السلة فارغة</h2><p className="mx-auto mb-7 max-w-sm text-sm leading-7 text-[#746c64]">اختاري قطعة من أفضل المبيعات، ثم عودي هنا لمراجعة طلبك قبل الدفع.</p><Link href="/#bestsellers" className="inline-flex items-center gap-3 bg-[#252220] px-7 py-3 text-sm font-semibold text-white hover:bg-[#8d2430]">اكتشفي أفضل المبيعات <ArrowLeft size={17} /></Link></div>}
    </main><footer className="mt-10 bg-[#252220] py-8 text-center text-xs text-white/60"><Link href="/" className="display-serif text-3xl text-[#f7f2ec]">Qatar Curves</Link><div className="mt-3">© 2026 Qatar Curves</div></footer>
  </div>;
}
