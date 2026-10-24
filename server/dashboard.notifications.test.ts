import { describe, expect, it } from "vitest";
import { DASHBOARD_SOUND_KEY, buildDashboardNotificationFeed, findNewDashboardNotification } from "../client/src/lib/dashboardNotifications";

const feed = buildDashboardNotificationFeed({
  visitors: [{ id: 1, currentPath: "/", pageViews: 1, startedAt: new Date("2026-09-25T07:00:00Z") }],
  stages: [{ id: 2, flowId: "flow-123456789", stage: "address", customerName: "عميل", phone: "55555", zone: "الدوحة", orderNumber: null, totalQar: null, createdAt: new Date("2026-09-25T07:01:00Z") }],
  payments: [{ id: 3, paypalOrderId: "PAYPAL123", orderNumber: "QC-123", customerName: "عميل", phone: "55555", zone: "الدوحة", totalQar: 172, paymentSource: "card", status: "completed", createdAt: new Date("2026-09-25T07:02:00Z"), updatedAt: new Date("2026-09-25T07:03:00Z") }],
});

describe("dashboard notification feed", () => {
  it("combines visitor, order, and payment events into one newest-first feed", () => {
    expect(feed.map(notification => notification.kind)).toEqual(["payment", "order", "visitor"]);
    expect(feed[0]).toMatchObject({ title: "تم السداد بنجاح", amountQar: 172, statusLabel: "تم التحصيل" });
    expect(feed[1]).toMatchObject({ title: "وصل طلب جديد", statusLabel: "الخطوة 1 · الطلب", flowId: "flow-123456789" });
    expect(feed[2]).toMatchObject({ title: "دخل زائر جديد إلى الموقع", statusLabel: "زيارة جديدة" });
  });

  it("does not announce existing notifications on the first dashboard load", () => {
    expect(findNewDashboardNotification(null, feed)).toBeUndefined();
  });

  it("returns the newest notification that was not previously present", () => {
    expect(findNewDashboardNotification(new Set(feed.slice(1).map(item => item.key)), feed)).toEqual(feed[0]);
  });

  it("uses a unique payment key when the payment status changes", () => {
    expect(feed[0].key).toBe("payment-3-completed");
  });

  it("uses a stable local preference key for the sound toggle", () => {
    expect(DASHBOARD_SOUND_KEY).toBe("qatar-curves-dashboard-sound");
  });
});
