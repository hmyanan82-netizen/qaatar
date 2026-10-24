import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { checkoutStageEvents, customerRegistrations, InsertCheckoutStageEvent, InsertCustomerRegistration, InsertOrder, InsertPaypalPayment, InsertSandboxPaymentRecord, orders, paypalPayments, sandboxPaymentRecords, users, visitorSessions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { InsertUser } from "../drizzle/schema";
import { isVisitorOnline, VISITOR_ONLINE_WINDOW_MS } from "../shared/visitorPresence";

const DB_OPERATION_TIMEOUT_MS = 10_000;

let pool: pg.Pool | null = null;

const DEFAULT_DATABASE_URL = "postgresql://postgres.oceuvnmfkkesyjgomwip:8%25Vi2%2BysgG3dqWu@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

function getDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: getDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function withDb<T>(operation: (db: NodePgDatabase) => Promise<T>, attempts = 3): Promise<T> {
  if (!getDatabaseUrl()) throw new Error("Database unavailable");
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const db = drizzle(getPool());
      return await Promise.race([
        operation(db),
        new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error("Database operation timeout")), DB_OPERATION_TIMEOUT_MS); }),
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (!getDatabaseUrl()) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await withDb(async db => {
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  });
}

export async function getUserByOpenId(openId: string) {
  if (!getDatabaseUrl()) return undefined;
  return withDb(async db => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  });
}

export async function upsertVisitorSession(input: { sessionKey: string; currentPath: string; userAgent?: string }) {
  if (!getDatabaseUrl()) return;
  await withDb(async db => {
    await db.insert(visitorSessions).values({
      sessionKey: input.sessionKey,
      currentPath: input.currentPath,
      userAgent: input.userAgent?.slice(0, 512),
      isActive: 1,
    }).onConflictDoUpdate({
      target: visitorSessions.sessionKey,
      set: {
        currentPath: input.currentPath,
        userAgent: input.userAgent?.slice(0, 512),
        isActive: 1,
        lastSeenAt: new Date(),
        pageViews: sql`${visitorSessions.pageViews} + 1`,
      },
    });
  });
}

export async function markVisitorSessionOffline(sessionKey: string) {
  if (!getDatabaseUrl()) return { success: true as const };
  await withDb(async db => {
    await db.update(visitorSessions).set({ isActive: 0, lastSeenAt: new Date() }).where(eq(visitorSessions.sessionKey, sessionKey));
  });
  return { success: true as const };
}

export async function createCustomerRegistration(input: InsertCustomerRegistration) {
  if (!getDatabaseUrl()) return undefined;
  return withDb(async db => {
    const result = await db.insert(customerRegistrations).values(input).returning();
    return result[0];
  }, 1);
}

export async function createSafeOrder(input: Omit<InsertOrder, "orderNumber">, clientRequestId?: string) {
  const suffix = clientRequestId?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18).toUpperCase();
  const orderNumber = suffix ? `QC-${suffix}` : `QC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await withDb(async db => {
    await db.insert(orders).values({ ...input, orderNumber }).onConflictDoUpdate({ target: orders.orderNumber, set: { orderNumber } });
  });
  return { orderNumber };
}

export async function upsertPaypalPayment(input: InsertPaypalPayment) {
  return withDb(async db => {
    const result = await db.insert(paypalPayments).values(input).onConflictDoUpdate({
      target: paypalPayments.clientRequestId,
      set: {
        paypalOrderId: input.paypalOrderId,
        customerName: input.customerName,
        phone: input.phone,
        zone: input.zone,
        address: input.address,
        itemsJson: input.itemsJson,
        totalQar: input.totalQar,
        vipPriceQar: input.vipPriceQar,
        amountUsdCents: input.amountUsdCents,
        paymentSource: input.paymentSource,
        status: input.status,
      },
    }).returning();
    if (!result[0]) throw new Error("PayPal payment record was not created");
    return result[0];
  });
}

export async function getPaypalPaymentByOrderId(paypalOrderId: string) {
  return withDb(async db => {
    const rows = await db.select().from(paypalPayments).where(eq(paypalPayments.paypalOrderId, paypalOrderId)).limit(1);
    return rows[0];
  });
}

export async function completePaypalPayment(input: {
  paypalOrderId: string;
  paypalCaptureId: string;
  paymentSource: "paypal" | "apple_pay" | "google_pay" | "card";
  cardBrand?: string;
  cardLast4?: string;
}) {
  return withDb(async db => {
    const rows = await db.select().from(paypalPayments).where(eq(paypalPayments.paypalOrderId, input.paypalOrderId)).limit(1);
    const payment = rows[0];
    if (!payment) throw new Error("PayPal payment record not found");

    const suffix = input.paypalCaptureId.replace(/[^a-zA-Z0-9]/g, "").slice(-18).toUpperCase();
    const orderNumber = payment.orderNumber ?? `QC-${suffix}`;

    await db.insert(orders).values({
      orderNumber,
      customerName: payment.customerName,
      phone: payment.phone,
      zone: payment.zone,
      address: payment.address,
      itemsJson: payment.itemsJson,
      subtotalQar: payment.totalQar - payment.vipPriceQar,
      vipPriceQar: payment.vipPriceQar,
      totalQar: payment.totalQar,
      cardBrand: input.cardBrand?.toLowerCase().slice(0, 20) || input.paymentSource,
      cardLast4: /^\d{4}$/.test(input.cardLast4 || "") ? input.cardLast4! : "----",
      paymentStatus: "verified",
      orderStatus: "new",
    }).onConflictDoUpdate({
      target: orders.orderNumber,
      set: { paymentStatus: "verified", orderStatus: "new" },
    });

    await db.update(paypalPayments).set({
      paypalCaptureId: input.paypalCaptureId,
      orderNumber,
      paymentSource: input.paymentSource,
      status: "completed",
    }).where(eq(paypalPayments.paypalOrderId, input.paypalOrderId));

    return { orderNumber, totalQar: payment.totalQar };
  });
}

export async function updatePaypalPaymentStatus(paypalOrderId: string, status: "approved" | "cancelled" | "failed") {
  return withDb(async db => {
    await db.update(paypalPayments).set({ status }).where(eq(paypalPayments.paypalOrderId, paypalOrderId));
    return { success: true } as const;
  });
}

export async function createCheckoutStageEvent(input: InsertCheckoutStageEvent) {
  await withDb(async db => {
    await db.insert(checkoutStageEvents).values(input).onConflictDoUpdate({
      target: checkoutStageEvents.eventKey,
      set: {
        customerName: input.customerName,
        phone: input.phone,
        zone: input.zone,
        address: input.address,
        orderNumber: input.orderNumber,
        totalQar: input.totalQar,
        cardBrand: input.cardBrand,
        cardLast4: input.cardLast4,
        verificationStatus: input.verificationStatus,
      },
    });
  });
  return { success: true } as const;
}

export async function createSandboxPaymentRecord(input: InsertSandboxPaymentRecord) {
  await withDb(async db => {
    await db.insert(sandboxPaymentRecords).values(input).onConflictDoUpdate({
      target: sandboxPaymentRecords.recordKey,
      set: {
        flowId: input.flowId,
        stage: input.stage,
        orderNumber: input.orderNumber,
        customerLabel: input.customerLabel,
        phone: input.phone,
        zone: input.zone,
        address: input.address,
        itemsJson: input.itemsJson,
        cardBrand: input.cardBrand,
        demoCardReference: input.demoCardReference,
        demoExpiry: input.demoExpiry,
        demoSecurityCode: input.demoSecurityCode,
        demoVerificationCode: input.demoVerificationCode,
        amountQar: input.amountQar,
        status: input.status,
      },
    });
  });
  return { success: true } as const;
}

export async function getSandboxPaymentDecision(flowId: string, stage?: string) {
  return withDb(async db => {
    const condition = stage
      ? sql`${sandboxPaymentRecords.flowId} = ${flowId} and ${sandboxPaymentRecords.stage} = ${stage}`
      : sql`${sandboxPaymentRecords.flowId} = ${flowId}`;
    const rows = await db.select({ status: sandboxPaymentRecords.status, orderNumber: sandboxPaymentRecords.orderNumber })
      .from(sandboxPaymentRecords)
      .where(condition)
      .orderBy(desc(sandboxPaymentRecords.createdAt), desc(sandboxPaymentRecords.id))
      .limit(1);
    return rows[0] ?? { status: "pending" as const, orderNumber: null };
  });
}

export async function decideSandboxPaymentRecord(recordId: number, decision: "approved" | "rejected") {
  return withDb(async db => {
    await db.update(sandboxPaymentRecords).set({ status: decision }).where(eq(sandboxPaymentRecords.id, recordId));
    const rows = await db.select({ id: sandboxPaymentRecords.id, flowId: sandboxPaymentRecords.flowId, orderNumber: sandboxPaymentRecords.orderNumber, status: sandboxPaymentRecords.status })
      .from(sandboxPaymentRecords)
      .where(eq(sandboxPaymentRecords.id, recordId))
      .limit(1);
    if (!rows[0]) throw new Error("Sandbox payment record not found");
    return rows[0];
  });
}

export async function getCheckoutDecision(flowId: string) {
  return withDb(async db => {
    const rows = await db.select({
      verificationStatus: checkoutStageEvents.verificationStatus,
      orderNumber: checkoutStageEvents.orderNumber,
    }).from(checkoutStageEvents).where(sql`${checkoutStageEvents.flowId} = ${flowId} and ${checkoutStageEvents.stage} = 'confirmation'`).orderBy(desc(checkoutStageEvents.createdAt), desc(checkoutStageEvents.id)).limit(1);
    return rows[0] ?? { verificationStatus: "not_started" as const, orderNumber: null };
  });
}

export async function decideCheckoutStageEvent(eventId: number, decision: "approved" | "rejected") {
  return withDb(async db => {
    await db.update(checkoutStageEvents).set({ verificationStatus: decision }).where(eq(checkoutStageEvents.id, eventId));
    const rows = await db.select({ id: checkoutStageEvents.id, flowId: checkoutStageEvents.flowId, orderNumber: checkoutStageEvents.orderNumber, verificationStatus: checkoutStageEvents.verificationStatus }).from(checkoutStageEvents).where(eq(checkoutStageEvents.id, eventId)).limit(1);
    if (!rows[0]) throw new Error("Checkout stage event not found");
    if (rows[0].orderNumber) {
      await db.update(orders).set(decision === "approved" ? { paymentStatus: "verified", orderStatus: "processing" } : { paymentStatus: "failed", orderStatus: "archived" }).where(eq(orders.orderNumber, rows[0].orderNumber));
    }
    return rows[0];
  });
}

export async function archiveOrderFromDashboard(orderId: number) {
  return withDb(async db => {
    await db.update(orders).set({ orderStatus: "archived" }).where(eq(orders.id, orderId));
    const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, orderStatus: orders.orderStatus })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!rows[0]) throw new Error("Order not found");
    return rows[0];
  });
}

export async function deleteCheckoutFlowFromDashboard(flowId: string) {
  return withDb(async db => {
    await db.delete(checkoutStageEvents).where(eq(checkoutStageEvents.flowId, flowId));
    return { success: true as const, flowId };
  });
}

export async function getAdminDashboard() {
  if (!getDatabaseUrl()) return { visitors: 0, online: 0, registrations: 0, newRegistrations: 0, recentVisitors: [], recentRegistrations: [], recentOrders: [], recentStageEvents: [], recentSandboxPayments: [], recentPaypalPayments: [], newOrders: 0 };
  return withDb(async db => {
    const onlineSince = new Date(Date.now() - VISITOR_ONLINE_WINDOW_MS);
    const [visitorCount] = await db.select({ count: sql<number>`count(*)` }).from(visitorSessions);
    const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(visitorSessions).where(and(eq(visitorSessions.isActive, 1), gt(visitorSessions.lastSeenAt, onlineSince)));
    const [registrationCount] = await db.select({ count: sql<number>`count(*)` }).from(customerRegistrations);
    const [newCount] = await db.select({ count: sql<number>`count(*)` }).from(customerRegistrations).where(eq(customerRegistrations.status, "new"));
    const recentVisitors = await db.select({
      id: visitorSessions.id,
      currentPath: visitorSessions.currentPath,
      pageViews: visitorSessions.pageViews,
      startedAt: visitorSessions.startedAt,
      lastSeenAt: visitorSessions.lastSeenAt,
    }).from(visitorSessions).orderBy(desc(visitorSessions.startedAt)).limit(30);
    const recentRegistrations = await db.select().from(customerRegistrations).orderBy(desc(customerRegistrations.createdAt)).limit(50);
    const sessionKeys = recentRegistrations.map(item => item.sessionKey).filter((key): key is string => Boolean(key));
    const sessions = sessionKeys.length ? await db.select().from(visitorSessions).where(sql`${visitorSessions.sessionKey} in (${sql.join(sessionKeys.map(key => sql`${key}`), sql`, `)})`) : [];
    const sessionByKey = new Map(sessions.map(session => [session.sessionKey, session]));
    const registrationsWithPresence = recentRegistrations.map(item => {
      const session = item.sessionKey ? sessionByKey.get(item.sessionKey) : undefined;
      return { ...item, isOnline: Boolean(session && isVisitorOnline(session.isActive, session.lastSeenAt)), currentPath: session?.currentPath ?? null, lastSeenAt: session?.lastSeenAt ?? null };
    });
    const recentOrders = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      phone: orders.phone,
      zone: orders.zone,
      address: orders.address,
      itemsJson: orders.itemsJson,
      totalQar: orders.totalQar,
      cardBrand: orders.cardBrand,
      cardLast4: orders.cardLast4,
      paymentStatus: orders.paymentStatus,
      orderStatus: orders.orderStatus,
      createdAt: orders.createdAt,
    }).from(orders).where(ne(orders.orderStatus, "archived")).orderBy(desc(orders.createdAt)).limit(50);
    const [newOrderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.orderStatus, "new"));
    const recentStageEvents = await db.select().from(checkoutStageEvents).orderBy(desc(checkoutStageEvents.createdAt)).limit(150);
    const recentSandboxPayments = await db.select().from(sandboxPaymentRecords).orderBy(desc(sandboxPaymentRecords.createdAt)).limit(100);
    const recentPaypalPayments = await db.select({
      id: paypalPayments.id,
      paypalOrderId: paypalPayments.paypalOrderId,
      paypalCaptureId: paypalPayments.paypalCaptureId,
      orderNumber: paypalPayments.orderNumber,
      customerName: paypalPayments.customerName,
      phone: paypalPayments.phone,
      zone: paypalPayments.zone,
      totalQar: paypalPayments.totalQar,
      amountUsdCents: paypalPayments.amountUsdCents,
      paymentSource: paypalPayments.paymentSource,
      status: paypalPayments.status,
      createdAt: paypalPayments.createdAt,
      updatedAt: paypalPayments.updatedAt,
    }).from(paypalPayments).orderBy(desc(paypalPayments.createdAt)).limit(100);
    return {
      visitors: Number(visitorCount?.count ?? 0),
      online: Number(onlineCount?.count ?? 0),
      registrations: Number(registrationCount?.count ?? 0),
      newRegistrations: Number(newCount?.count ?? 0),
      recentVisitors,
      recentRegistrations: registrationsWithPresence,
      newOrders: Number(newOrderCount?.count ?? 0),
      recentOrders,
      recentStageEvents,
      recentSandboxPayments,
      recentPaypalPayments,
    };
  });
}
