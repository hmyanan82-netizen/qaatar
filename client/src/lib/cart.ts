/* Qatar Curves — single source of truth for cart items; product media, selections, and sale pricing stay together. */
export const SALE_PERCENT = 60;
export const VIP_PRICE_QAR = 55;

export function discountedPrice(originalPriceQar: number) {
  return Math.round(originalPriceQar * (1 - SALE_PERCENT / 100));
}

export type CartItem = {
  id: string;
  name: string;
  image: string;
  priceQar: number;
  originalPriceQar?: number;
  salePercent?: number;
  size: string;
  age: number;
  color?: "Cocoa" | "Beige" | "Black";
  quantity: number;
};

export type VipAddon = {
  name: "خدمة VIP";
  priceQar: number;
  date: string;
  time: string;
  zone: string;
};

export type CartState = { items: CartItem[]; vip?: VipAddon };

const KEY = "qatar-curves-cart-v2";

export const PRODUCT_PRICE_OVERRIDES_QAR: Record<string, { originalPriceQar: number; priceQar: number }> = {
  "CURVES 6152": { originalPriceQar: 525, priceQar: 210 },
};

export function normalizeCartItemPricing(item: CartItem): CartItem {
  const priceOverride = PRODUCT_PRICE_OVERRIDES_QAR[item.name];
  if (priceOverride) {
    return {
      ...item,
      ...priceOverride,
      salePercent: SALE_PERCENT,
    };
  }
  if (item.salePercent === SALE_PERCENT && item.originalPriceQar) return item;
  const originalPriceQar = item.originalPriceQar ?? item.priceQar;
  return {
    ...item,
    originalPriceQar,
    priceQar: discountedPrice(originalPriceQar),
    salePercent: SALE_PERCENT,
  };
}

function normalizeVip(vip?: VipAddon): VipAddon | undefined {
  return vip ? { ...vip, priceQar: VIP_PRICE_QAR } : undefined;
}

export function readCart(): CartState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    if (parsed?.items && Array.isArray(parsed.items)) {
      const normalized = {
        ...parsed,
        items: parsed.items.map(normalizeCartItemPricing),
        vip: normalizeVip(parsed.vip),
      } as CartState;
      if (JSON.stringify(normalized) !== JSON.stringify(parsed)) localStorage.setItem(KEY, JSON.stringify(normalized));
      return normalized;
    }
    const legacy = JSON.parse(localStorage.getItem("qatar-curves-order") || "null");
    if (legacy?.name) {
      const originalPriceQar = legacy.originalPriceQar ?? legacy.priceQar;
      return {
        items: [normalizeCartItemPricing({
          id: `${legacy.name}-${legacy.size || "unset"}`,
          name: legacy.name,
          image: legacy.image,
          priceQar: originalPriceQar,
          originalPriceQar,
          size: legacy.size || "",
          age: legacy.age || 30,
          color: legacy.color || "Cocoa",
          quantity: legacy.quantity || 1,
        })],
        vip: normalizeVip(legacy.vip),
      };
    }
  } catch { /* use empty cart */ }
  return { items: [] };
}

export function writeCart(cart: CartState) {
  const normalized = {
    ...cart,
    items: cart.items.map(normalizeCartItemPricing),
    vip: normalizeVip(cart.vip),
  };
  localStorage.setItem(KEY, JSON.stringify(normalized));
  localStorage.setItem("qatar-curves-order", JSON.stringify({ ...(normalized.items[0] || {}), vip: normalized.vip }));
  window.dispatchEvent(new Event("qatar-cart-change"));
}

export function addCartItem(item: CartItem) {
  const cart = readCart();
  const normalizedItem = normalizeCartItemPricing(item);
  const existing = cart.items.find((entry) => entry.id === normalizedItem.id);
  if (existing) existing.quantity += normalizedItem.quantity;
  else cart.items.push(normalizedItem);
  writeCart(cart);
}

export function addVipAddon(vip: VipAddon) {
  const cart = readCart();
  writeCart({ ...cart, vip });
}

export function cartTotal(cart: CartState) {
  return cart.items.reduce((sum, item) => sum + item.priceQar * item.quantity, 0) + (cart.vip?.priceQar || 0);
}

export function cartQuickSummary(cart: CartState) {
  return {
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    productLines: cart.items.map(item => ({ name: item.name, quantity: item.quantity })),
    vipIncluded: Boolean(cart.vip),
    totalQar: cartTotal(cart),
  };
}
