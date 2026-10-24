export const DASHBOARD_SOUND_KEY = "qatar-curves-dashboard-sound";

export type DashboardVisitorSource = {
  id: number;
  currentPath: string;
  pageViews: number;
  startedAt: Date;
};

export type DashboardStageSource = {
  id: number;
  flowId: string;
  stage: "address" | "payment" | "confirmation";
  customerName: string | null;
  phone: string | null;
  zone: string | null;
  orderNumber: string | null;
  totalQar: number | null;
  createdAt: Date;
};

export type DashboardPaymentSource = {
  id: number;
  paypalOrderId: string;
  orderNumber: string | null;
  customerName: string;
  phone: string;
  zone: string;
  totalQar: number;
  paymentSource: "paypal" | "apple_pay" | "google_pay" | "card";
  status: "created" | "approved" | "completed" | "cancelled" | "failed";
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardNotification = {
  key: string;
  kind: "visitor" | "order" | "payment";
  badge: "زائر" | "طلب" | "سداد";
  title: string;
  subtitle: string;
  customerName?: string;
  phone?: string;
  amountQar?: number;
  statusLabel: string;
  occurredAt: Date;
  flowId?: string;
};

export function buildDashboardNotificationFeed(input: {
  visitors: readonly DashboardVisitorSource[];
  stages: readonly DashboardStageSource[];
  payments: readonly DashboardPaymentSource[];
}): DashboardNotification[] {
  const visitorNotifications: DashboardNotification[] = input.visitors.map(visitor => ({
    key: `visitor-${visitor.id}`,
    kind: "visitor",
    badge: "زائر",
    title: "دخل زائر جديد إلى الموقع",
    subtitle: visitor.currentPath || "/",
    statusLabel: visitor.pageViews > 1 ? `${visitor.pageViews} مشاهدات` : "زيارة جديدة",
    occurredAt: visitor.startedAt,
  }));

  const stageNotifications: DashboardNotification[] = input.stages.map(event => {
    const title = event.stage === "address"
      ? "وصل طلب جديد"
      : event.stage === "payment"
        ? "انتقل العميل إلى السداد"
        : "وصل الطلب إلى تأكيد السداد";
    const subtitle = event.stage === "address"
      ? event.zone || "تم إدخال بيانات التوصيل"
      : event.orderNumber || "تحديث في مسار الدفع";
    const statusLabel = event.stage === "address" ? "الخطوة 1 · الطلب" : event.stage === "payment" ? "الخطوة 2 · السداد" : "الخطوة 3 · التأكيد";
    return {
      key: `stage-${event.id}`,
      kind: "order" as const,
      badge: "طلب" as const,
      title,
      subtitle,
      customerName: event.customerName || undefined,
      phone: event.phone || undefined,
      amountQar: event.totalQar || undefined,
      statusLabel,
      occurredAt: event.createdAt,
      flowId: event.flowId,
    };
  });

  const paymentNotifications: DashboardNotification[] = input.payments.map(payment => {
    const title = payment.status === "completed"
      ? "تم السداد بنجاح"
      : payment.status === "failed"
        ? "فشل السداد"
        : payment.status === "cancelled"
          ? "أُلغي السداد"
          : payment.status === "approved"
            ? "وافق العميل على السداد"
            : "بدأ العميل السداد";
    const source = payment.paymentSource === "card" ? "Visa / Mastercard" : payment.paymentSource === "apple_pay" ? "Apple Pay" : payment.paymentSource === "google_pay" ? "Google Pay" : "PayPal";
    return {
      key: `payment-${payment.id}-${payment.status}`,
      kind: "payment" as const,
      badge: "سداد" as const,
      title,
      subtitle: `${source} · ${payment.orderNumber || payment.paypalOrderId}`,
      customerName: payment.customerName,
      phone: payment.phone,
      amountQar: payment.totalQar,
      statusLabel: payment.status === "completed" ? "تم التحصيل" : payment.status === "failed" ? "فشل" : payment.status === "cancelled" ? "ملغي" : "قيد المتابعة",
      occurredAt: payment.status === "created" ? payment.createdAt : payment.updatedAt,
    };
  });

  return [...visitorNotifications, ...stageNotifications, ...paymentNotifications]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

export function findNewDashboardNotification<T extends { key: string }>(
  previousKeys: ReadonlySet<string> | null,
  notifications: readonly T[],
): T | undefined {
  if (!previousKeys) return undefined;
  return notifications.find(notification => !previousKeys.has(notification.key));
}
