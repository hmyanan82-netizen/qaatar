import { createRequire } from "module"; const require = createRequire(import.meta.url);

// server/api-handler.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// drizzle/schema.ts
import { integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["user", "admin"]);
var registrationStatusEnum = pgEnum("registration_status", ["new", "contacted", "archived"]);
var paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "failed"]);
var orderStatusEnum = pgEnum("order_status", ["new", "processing", "completed", "archived"]);
var paymentSourceEnum = pgEnum("payment_source", ["paypal", "apple_pay", "google_pay", "card"]);
var paypalStatusEnum = pgEnum("paypal_status", ["created", "approved", "completed", "cancelled", "failed"]);
var checkoutStageEnum = pgEnum("checkout_stage", ["address", "payment", "confirmation"]);
var verificationStatusEnum = pgEnum("verification_status", ["not_started", "submitted", "approved", "rejected"]);
var sandboxStageEnum = pgEnum("sandbox_stage", ["payment", "confirmation"]);
var cardBrandEnum = pgEnum("card_brand", ["visa", "mastercard", "mada"]);
var sandboxStatusEnum = pgEnum("sandbox_status", ["received", "pending", "approved", "rejected"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var visitorSessions = pgTable("visitor_sessions", {
  id: serial("id").primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }).notNull().unique(),
  currentPath: varchar("currentPath", { length: 255 }).notNull().default("/"),
  userAgent: varchar("userAgent", { length: 512 }),
  isActive: integer("isActive").notNull().default(1),
  pageViews: integer("pageViews").notNull().default(1),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull()
}, (table) => ({ sessionKeyIdx: uniqueIndex("visitor_sessions_session_key_idx").on(table.sessionKey) }));
var customerRegistrations = pgTable("customer_registrations", {
  id: serial("id").primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  status: registrationStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  registrationId: integer("registrationId"),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  subtotalQar: integer("subtotalQar").notNull(),
  vipPriceQar: integer("vipPriceQar").notNull().default(0),
  totalQar: integer("totalQar").notNull(),
  cardBrand: varchar("cardBrand", { length: 20 }).notNull(),
  cardLast4: varchar("cardLast4", { length: 4 }).notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("verified").notNull(),
  orderStatus: orderStatusEnum("orderStatus").default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => ({ orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber) }));
var paypalPayments = pgTable("paypal_payments", {
  id: serial("id").primaryKey(),
  clientRequestId: varchar("clientRequestId", { length: 80 }).notNull().unique(),
  paypalOrderId: varchar("paypalOrderId", { length: 40 }).notNull().unique(),
  paypalCaptureId: varchar("paypalCaptureId", { length: 40 }).unique(),
  orderNumber: varchar("orderNumber", { length: 32 }).unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  totalQar: integer("totalQar").notNull(),
  vipPriceQar: integer("vipPriceQar").notNull().default(0),
  amountUsdCents: integer("amountUsdCents").notNull(),
  paymentSource: paymentSourceEnum("paymentSource").notNull().default("card"),
  status: paypalStatusEnum("status").notNull().default("created"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var checkoutStageEvents = pgTable("checkout_stage_events", {
  id: serial("id").primaryKey(),
  eventKey: varchar("eventKey", { length: 96 }).notNull().unique(),
  flowId: varchar("flowId", { length: 64 }).notNull(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  stage: checkoutStageEnum("stage").notNull(),
  customerName: varchar("customerName", { length: 160 }),
  phone: varchar("phone", { length: 40 }),
  zone: varchar("zone", { length: 120 }),
  address: text("address"),
  orderNumber: varchar("orderNumber", { length: 32 }),
  totalQar: integer("totalQar"),
  cardBrand: varchar("cardBrand", { length: 20 }),
  cardLast4: varchar("cardLast4", { length: 4 }),
  verificationStatus: verificationStatusEnum("verificationStatus").default("not_started").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ eventKeyIdx: uniqueIndex("checkout_stage_events_event_key_idx").on(table.eventKey) }));
var sandboxPaymentRecords = pgTable("sandbox_payment_records", {
  id: serial("id").primaryKey(),
  recordKey: varchar("recordKey", { length: 96 }).notNull().unique(),
  flowId: varchar("flowId", { length: 64 }).notNull(),
  demoReference: varchar("demoReference", { length: 40 }),
  stage: sandboxStageEnum("stage").notNull(),
  orderNumber: varchar("orderNumber", { length: 32 }),
  customerLabel: varchar("customerLabel", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  cardBrand: cardBrandEnum("cardBrand"),
  demoCardReference: varchar("demoCardReference", { length: 48 }),
  demoExpiry: varchar("demoExpiry", { length: 5 }),
  demoSecurityCode: varchar("demoSecurityCode", { length: 20 }),
  demoVerificationCode: varchar("demoVerificationCode", { length: 24 }),
  amountQar: integer("amountQar").notNull().default(0),
  status: sandboxStatusEnum("status").default("received").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({ recordKeyIdx: uniqueIndex("sandbox_payment_records_record_key_idx").on(table.recordKey) }));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID || "qatar-curves",
  cookieSecret: process.env.JWT_SECRET || "qatarcurves-jwt-secret-2026-x9k2m",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres.oceuvnmfkkesyjgomwip:8%25Vi2%2BysgG3dqWu@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// shared/visitorPresence.ts
var VISITOR_ONLINE_WINDOW_MS = 45e3;
function isVisitorOnline(isActive, lastSeenAt, now = Date.now()) {
  return Boolean(isActive) && now - lastSeenAt.getTime() < VISITOR_ONLINE_WINDOW_MS;
}

// server/db.ts
var DB_OPERATION_TIMEOUT_MS = 1e4;
var pool = null;
var DEFAULT_DATABASE_URL = "postgresql://postgres.oceuvnmfkkesyjgomwip:8%25Vi2%2BysgG3dqWu@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
function getDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}
function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: getDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 15e3,
      connectionTimeoutMillis: 1e4,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}
async function withDb(operation, attempts = 3) {
  if (!getDatabaseUrl()) throw new Error("Database unavailable");
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let timeout;
    try {
      const db = drizzle(getPool());
      return await Promise.race([
        operation(db),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Database operation timeout")), DB_OPERATION_TIMEOUT_MS);
        })
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  throw lastError;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (!getDatabaseUrl()) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= /* @__PURE__ */ new Date();
  updateSet.lastSignedIn ??= /* @__PURE__ */ new Date();
  await withDb(async (db) => {
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  });
}
async function getUserByOpenId(openId) {
  if (!getDatabaseUrl()) return void 0;
  return withDb(async (db) => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  });
}
async function upsertVisitorSession(input) {
  if (!getDatabaseUrl()) return;
  await withDb(async (db) => {
    await db.insert(visitorSessions).values({
      sessionKey: input.sessionKey,
      currentPath: input.currentPath,
      userAgent: input.userAgent?.slice(0, 512),
      isActive: 1
    }).onConflictDoUpdate({
      target: visitorSessions.sessionKey,
      set: {
        currentPath: input.currentPath,
        userAgent: input.userAgent?.slice(0, 512),
        isActive: 1,
        lastSeenAt: /* @__PURE__ */ new Date(),
        pageViews: sql`${visitorSessions.pageViews} + 1`
      }
    });
  });
}
async function markVisitorSessionOffline(sessionKey) {
  if (!getDatabaseUrl()) return { success: true };
  await withDb(async (db) => {
    await db.update(visitorSessions).set({ isActive: 0, lastSeenAt: /* @__PURE__ */ new Date() }).where(eq(visitorSessions.sessionKey, sessionKey));
  });
  return { success: true };
}
async function createCustomerRegistration(input) {
  if (!getDatabaseUrl()) return void 0;
  return withDb(async (db) => {
    const result = await db.insert(customerRegistrations).values(input).returning();
    return result[0];
  }, 1);
}
async function createSafeOrder(input, clientRequestId) {
  const suffix = clientRequestId?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18).toUpperCase();
  const orderNumber = suffix ? `QC-${suffix}` : `QC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await withDb(async (db) => {
    await db.insert(orders).values({ ...input, orderNumber }).onConflictDoUpdate({ target: orders.orderNumber, set: { orderNumber } });
  });
  return { orderNumber };
}
async function upsertPaypalPayment(input) {
  return withDb(async (db) => {
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
        status: input.status
      }
    }).returning();
    if (!result[0]) throw new Error("PayPal payment record was not created");
    return result[0];
  });
}
async function getPaypalPaymentByOrderId(paypalOrderId) {
  return withDb(async (db) => {
    const rows = await db.select().from(paypalPayments).where(eq(paypalPayments.paypalOrderId, paypalOrderId)).limit(1);
    return rows[0];
  });
}
async function completePaypalPayment(input) {
  return withDb(async (db) => {
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
      cardLast4: /^\d{4}$/.test(input.cardLast4 || "") ? input.cardLast4 : "----",
      paymentStatus: "verified",
      orderStatus: "new"
    }).onConflictDoUpdate({
      target: orders.orderNumber,
      set: { paymentStatus: "verified", orderStatus: "new" }
    });
    await db.update(paypalPayments).set({
      paypalCaptureId: input.paypalCaptureId,
      orderNumber,
      paymentSource: input.paymentSource,
      status: "completed"
    }).where(eq(paypalPayments.paypalOrderId, input.paypalOrderId));
    return { orderNumber, totalQar: payment.totalQar };
  });
}
async function updatePaypalPaymentStatus(paypalOrderId, status) {
  return withDb(async (db) => {
    await db.update(paypalPayments).set({ status }).where(eq(paypalPayments.paypalOrderId, paypalOrderId));
    return { success: true };
  });
}
async function createCheckoutStageEvent(input) {
  await withDb(async (db) => {
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
        verificationStatus: input.verificationStatus
      }
    });
  });
  return { success: true };
}
async function createSandboxPaymentRecord(input) {
  await withDb(async (db) => {
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
        status: input.status
      }
    });
  });
  return { success: true };
}
async function getSandboxPaymentDecision(flowId) {
  return withDb(async (db) => {
    const rows = await db.select({ status: sandboxPaymentRecords.status, orderNumber: sandboxPaymentRecords.orderNumber }).from(sandboxPaymentRecords).where(sql`${sandboxPaymentRecords.flowId} = ${flowId} and ${sandboxPaymentRecords.stage} = 'confirmation'`).orderBy(desc(sandboxPaymentRecords.createdAt), desc(sandboxPaymentRecords.id)).limit(1);
    return rows[0] ?? { status: "pending", orderNumber: null };
  });
}
async function decideSandboxPaymentRecord(recordId, decision) {
  return withDb(async (db) => {
    await db.update(sandboxPaymentRecords).set({ status: decision }).where(eq(sandboxPaymentRecords.id, recordId));
    const rows = await db.select({ id: sandboxPaymentRecords.id, flowId: sandboxPaymentRecords.flowId, orderNumber: sandboxPaymentRecords.orderNumber, status: sandboxPaymentRecords.status }).from(sandboxPaymentRecords).where(eq(sandboxPaymentRecords.id, recordId)).limit(1);
    if (!rows[0]) throw new Error("Sandbox payment record not found");
    return rows[0];
  });
}
async function getCheckoutDecision(flowId) {
  return withDb(async (db) => {
    const rows = await db.select({
      verificationStatus: checkoutStageEvents.verificationStatus,
      orderNumber: checkoutStageEvents.orderNumber
    }).from(checkoutStageEvents).where(sql`${checkoutStageEvents.flowId} = ${flowId} and ${checkoutStageEvents.stage} = 'confirmation'`).orderBy(desc(checkoutStageEvents.createdAt), desc(checkoutStageEvents.id)).limit(1);
    return rows[0] ?? { verificationStatus: "not_started", orderNumber: null };
  });
}
async function decideCheckoutStageEvent(eventId, decision) {
  return withDb(async (db) => {
    await db.update(checkoutStageEvents).set({ verificationStatus: decision }).where(eq(checkoutStageEvents.id, eventId));
    const rows = await db.select({ id: checkoutStageEvents.id, flowId: checkoutStageEvents.flowId, orderNumber: checkoutStageEvents.orderNumber, verificationStatus: checkoutStageEvents.verificationStatus }).from(checkoutStageEvents).where(eq(checkoutStageEvents.id, eventId)).limit(1);
    if (!rows[0]) throw new Error("Checkout stage event not found");
    if (rows[0].orderNumber) {
      await db.update(orders).set(decision === "approved" ? { paymentStatus: "verified", orderStatus: "processing" } : { paymentStatus: "failed", orderStatus: "archived" }).where(eq(orders.orderNumber, rows[0].orderNumber));
    }
    return rows[0];
  });
}
async function archiveOrderFromDashboard(orderId) {
  return withDb(async (db) => {
    await db.update(orders).set({ orderStatus: "archived" }).where(eq(orders.id, orderId));
    const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, orderStatus: orders.orderStatus }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!rows[0]) throw new Error("Order not found");
    return rows[0];
  });
}
async function deleteCheckoutFlowFromDashboard(flowId) {
  return withDb(async (db) => {
    await db.delete(checkoutStageEvents).where(eq(checkoutStageEvents.flowId, flowId));
    return { success: true, flowId };
  });
}
async function getAdminDashboard() {
  if (!getDatabaseUrl()) return { visitors: 0, online: 0, registrations: 0, newRegistrations: 0, recentVisitors: [], recentRegistrations: [], recentOrders: [], recentStageEvents: [], recentSandboxPayments: [], recentPaypalPayments: [], newOrders: 0 };
  return withDb(async (db) => {
    const onlineSince = new Date(Date.now() - VISITOR_ONLINE_WINDOW_MS);
    const [visitorCount] = await db.select({ count: sql`count(*)` }).from(visitorSessions);
    const [onlineCount] = await db.select({ count: sql`count(*)` }).from(visitorSessions).where(and(eq(visitorSessions.isActive, 1), gt(visitorSessions.lastSeenAt, onlineSince)));
    const [registrationCount] = await db.select({ count: sql`count(*)` }).from(customerRegistrations);
    const [newCount] = await db.select({ count: sql`count(*)` }).from(customerRegistrations).where(eq(customerRegistrations.status, "new"));
    const recentVisitors = await db.select({
      id: visitorSessions.id,
      currentPath: visitorSessions.currentPath,
      pageViews: visitorSessions.pageViews,
      startedAt: visitorSessions.startedAt,
      lastSeenAt: visitorSessions.lastSeenAt
    }).from(visitorSessions).orderBy(desc(visitorSessions.startedAt)).limit(30);
    const recentRegistrations = await db.select().from(customerRegistrations).orderBy(desc(customerRegistrations.createdAt)).limit(50);
    const sessionKeys = recentRegistrations.map((item) => item.sessionKey).filter((key) => Boolean(key));
    const sessions = sessionKeys.length ? await db.select().from(visitorSessions).where(sql`${visitorSessions.sessionKey} in (${sql.join(sessionKeys.map((key) => sql`${key}`), sql`, `)})`) : [];
    const sessionByKey = new Map(sessions.map((session) => [session.sessionKey, session]));
    const registrationsWithPresence = recentRegistrations.map((item) => {
      const session = item.sessionKey ? sessionByKey.get(item.sessionKey) : void 0;
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
      createdAt: orders.createdAt
    }).from(orders).where(ne(orders.orderStatus, "archived")).orderBy(desc(orders.createdAt)).limit(50);
    const [newOrderCount] = await db.select({ count: sql`count(*)` }).from(orders).where(eq(orders.orderStatus, "new"));
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
      updatedAt: paypalPayments.updatedAt
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
      recentPaypalPayments
    };
  });
}

// server/_core/cookies.ts
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      if (ENV.oAuthServerUrl) {
        try {
          const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
          await upsertUser({
            openId: userInfo.openId,
            name: userInfo.name || null,
            email: userInfo.email ?? null,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
            lastSignedIn: signedInAt
          });
          user = await getUserByOpenId(userInfo.openId);
        } catch (error) {
          console.error("[Auth] Failed to sync user from OAuth:", error);
          throw ForbiddenError("Failed to sync user info");
        }
      } else {
        throw ForbiddenError("User not found");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/paypal.ts
var PAYPAL_CURRENCY = "USD";
var QAR_PER_USD = 3.64;
var VIP_PRICE_QAR = 55;
var PRODUCT_PRICES_QAR = {
  "CURVES 6172": 289,
  "CURVES 6153": 289,
  "Ann chery 5166": 318,
  "Curves 7811 high waist short": 191,
  "Ann chery 1024 Plus size": 172,
  "CURVES 6152": 210,
  "Curves 4000 Full Coverage back Bra": 74,
  "Ann chery 5147": 333,
  "Ann chery 5177": 368,
  "Ann Chery 5012L - Long short": 387,
  "CURVES 1503": 226,
  "Curves 1625": 162,
  "TIRAIN 3IN1 POSTPARTUM BELT": 147
};
var PAYPAL_API_BASE = "https://api-m.paypal.com";
var cachedAccessToken = null;
function liveCredentials() {
  const clientId = process.env.PAYPAL_LIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_LIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("PayPal Live credentials are not configured");
  return { clientId, clientSecret };
}
async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 6e4) return cachedAccessToken.value;
  const { clientId, clientSecret } = liveCredentials();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(2e4)
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`PayPal authentication failed (${response.status}: ${data.error ?? "unknown_error"})`);
  cachedAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 300) * 1e3
  };
  return cachedAccessToken.value;
}
async function paypalRequest(path, options) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.requestId ? { "PayPal-Request-Id": options.requestId } : {}
    },
    body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
    signal: AbortSignal.timeout(25e3)
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.details?.[0]?.description ?? data.message ?? data.name ?? "PayPal request failed";
    const field = data.details?.[0]?.field;
    throw new Error(`${detail}${field ? ` [${field}]` : ""} (${response.status}${data.debug_id ? `, ${data.debug_id}` : ""})`);
  }
  return data;
}
function getPaypalLiveClientId() {
  return liveCredentials().clientId;
}
async function generatePaypalClientToken() {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/identity/generate-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Accept-Language": "ar-QA",
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(2e4)
  });
  const data = await response.json();
  if (!response.ok || !data.client_token) {
    throw new Error(`PayPal client token failed (${response.status}: ${data.error_description ?? data.error ?? "unknown_error"})`);
  }
  return data.client_token;
}
function verifyPaypalCart(items, vipIncluded) {
  if (!items.length && !vipIncluded) throw new Error("Cart is empty");
  const verifiedItems = items.map((item) => {
    const priceQar = PRODUCT_PRICES_QAR[item.name];
    if (!priceQar) throw new Error(`Unknown product: ${item.name}`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new Error("Invalid product quantity");
    return { ...item, priceQar };
  });
  const subtotalQar = verifiedItems.reduce((sum, item) => sum + item.priceQar * item.quantity, 0);
  const vipPriceQar = vipIncluded ? VIP_PRICE_QAR : 0;
  const totalQar = subtotalQar + vipPriceQar;
  const amountUsdCents = Math.round(totalQar * 100 / QAR_PER_USD);
  return {
    items: verifiedItems,
    subtotalQar,
    vipPriceQar,
    totalQar,
    amountUsdCents,
    amountUsd: (amountUsdCents / 100).toFixed(2)
  };
}
function buildPaypalOrderPayload(input) {
  return {
    intent: "CAPTURE",
    application_context: {
      brand_name: "Qatar Curves",
      landing_page: "BILLING",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW"
    },
    purchase_units: [{
      reference_id: input.clientRequestId,
      custom_id: input.clientRequestId,
      description: "Qatar Curves order",
      amount: {
        currency_code: PAYPAL_CURRENCY,
        value: input.cart.amountUsd
      }
    }]
  };
}
async function createPaypalOrder(input) {
  const order = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    requestId: input.clientRequestId,
    body: buildPaypalOrderPayload(input)
  });
  if (!order.id) throw new Error("PayPal did not return an order ID");
  return { orderId: order.id, status: order.status, amountUsd: input.cart.amountUsd };
}
async function capturePaypalOrder(paypalOrderId, clientRequestId) {
  const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    requestId: `${clientRequestId}-capture`.slice(0, 108)
  });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture?.id || capture.status !== "COMPLETED") throw new Error(`PayPal capture is not completed (${capture?.status ?? order.status})`);
  const paymentSource = order.payment_source?.apple_pay ? "apple_pay" : order.payment_source?.google_pay ? "google_pay" : order.payment_source?.card ? "card" : "paypal";
  return {
    orderId: order.id,
    captureId: capture.id,
    status: capture.status,
    paymentSource,
    cardBrand: order.payment_source?.card?.brand,
    cardLast4: order.payment_source?.card?.last_digits,
    currency: capture.amount?.currency_code,
    amount: capture.amount?.value
  };
}

// server/routers.ts
var visitorInput = z2.object({
  sessionKey: z2.string().min(12).max(96),
  currentPath: z2.string().max(255).default("/"),
  userAgent: z2.string().max(512).optional()
});
var safeOrderInput = z2.object({
  clientRequestId: z2.string().regex(/^[a-zA-Z0-9-]{12,64}$/).optional(),
  sessionKey: z2.string().min(12).max(96).optional(),
  customerName: z2.string().min(2).max(160),
  phone: z2.string().min(5).max(40),
  zone: z2.string().min(2).max(120),
  address: z2.string().max(2e3).optional(),
  items: z2.array(z2.object({
    name: z2.string().min(1).max(200),
    quantity: z2.number().int().min(1).max(20),
    size: z2.string().max(30),
    color: z2.string().max(30).optional(),
    priceQar: z2.number().int().min(0).max(1e5)
  }).strict()).min(1).max(50),
  vipPriceQar: z2.number().int().min(0).max(1e5).default(0),
  cardBrand: z2.enum(["visa", "mastercard", "mada"]),
  cardLast4: z2.string().regex(/^\d{4}$/)
}).strict();
var paypalCheckoutInput = z2.object({
  clientRequestId: z2.string().min(12).max(80).regex(/^[a-zA-Z0-9-]+$/),
  customerName: z2.string().min(2).max(160),
  phone: z2.string().min(5).max(40),
  zone: z2.string().min(2).max(120),
  address: z2.string().max(1e3).optional(),
  items: z2.array(z2.object({
    name: z2.string().min(2).max(160),
    quantity: z2.number().int().min(1).max(10),
    size: z2.string().min(1).max(40),
    color: z2.string().max(40).optional()
  }).strict()).max(20),
  vipIncluded: z2.boolean().default(false),
  paymentSource: z2.enum(["paypal", "apple_pay", "google_pay", "card"]).default("card")
}).strict();
var checkoutStageInput = z2.discriminatedUnion("stage", [
  z2.object({
    stage: z2.literal("address"),
    eventKey: z2.string().min(12).max(96),
    flowId: z2.string().min(12).max(64),
    sessionKey: z2.string().min(12).max(96).optional(),
    customerName: z2.string().min(2).max(160),
    phone: z2.string().min(5).max(40),
    zone: z2.string().min(2).max(120),
    address: z2.string().max(2e3).optional()
  }).strict(),
  z2.object({
    stage: z2.literal("payment"),
    eventKey: z2.string().min(12).max(96),
    flowId: z2.string().min(12).max(64),
    sessionKey: z2.string().min(12).max(96).optional(),
    customerName: z2.string().min(2).max(160),
    phone: z2.string().min(5).max(40),
    totalQar: z2.number().int().min(0).max(5e5),
    cardBrand: z2.enum(["visa", "mastercard", "mada"]),
    cardLast4: z2.string().regex(/^\d{4}$/)
  }).strict(),
  z2.object({
    stage: z2.literal("confirmation"),
    eventKey: z2.string().min(12).max(96),
    flowId: z2.string().min(12).max(64),
    sessionKey: z2.string().min(12).max(96).optional(),
    customerName: z2.string().min(2).max(160),
    phone: z2.string().min(5).max(40),
    orderNumber: z2.string().min(4).max(32),
    totalQar: z2.number().int().min(0).max(5e5),
    cardBrand: z2.enum(["visa", "mastercard", "mada"]),
    cardLast4: z2.string().regex(/^\d{4}$/)
  }).strict()
]);
var sandboxBase = {
  recordKey: z2.string().regex(/^[a-zA-Z0-9-]{12,96}$/),
  flowId: z2.string().regex(/^[a-zA-Z0-9-]{12,64}$/),
  customerLabel: z2.string().min(2).max(120),
  phone: z2.string().min(5).max(40),
  zone: z2.string().min(2).max(120),
  address: z2.string().max(2e3).optional(),
  items: z2.array(z2.object({ name: z2.string().min(1).max(200), quantity: z2.number().int().min(1).max(20), size: z2.string().max(30), color: z2.string().max(30).optional(), priceQar: z2.number().int().min(0).max(1e5) }).strict()).min(1).max(50),
  amountQar: z2.number().int().min(0).max(5e5)
};
var sandboxCardFields = {
  cardBrand: z2.enum(["visa", "mastercard", "mada"]),
  demoCardNumber: z2.enum(["4242424242424242", "5555555555554444", "5888450000000000"]),
  demoExpiry: z2.string().regex(/^(0[1-9]|1[0-2])\/([2-9][0-9])$/),
  demoSecurityCode: z2.enum(["123", "999"])
};
var sandboxPaymentInput = z2.discriminatedUnion("stage", [
  z2.object({ ...sandboxBase, ...sandboxCardFields, stage: z2.literal("payment") }).strict(),
  z2.object({ ...sandboxBase, ...sandboxCardFields, stage: z2.literal("confirmation"), orderNumber: z2.string().regex(/^DEMO-[A-Z0-9-]{6,26}$/), demoVerificationCode: z2.enum(["123456", "654321"]) }).strict()
]);
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    loginWithPassword: publicProcedure.input(z2.object({ password: z2.string().min(1) })).mutation(async ({ input, ctx }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || "Qatar2026Admin";
      if (!adminPassword) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Admin password not configured" });
      if (input.password !== adminPassword) throw new TRPCError3({ code: "UNAUTHORIZED", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      const openId = "admin-owner";
      await upsertUser({ openId, name: "Admin", role: "admin", lastSignedIn: /* @__PURE__ */ new Date() });
      const token = await sdk.createSessionToken(openId, { name: "Admin", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, token, cookieName: COOKIE_NAME };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  analytics: router({
    heartbeat: publicProcedure.input(visitorInput).mutation(({ input }) => upsertVisitorSession(input)),
    leave: publicProcedure.input(z2.object({ sessionKey: z2.string().min(12).max(96) }).strict()).mutation(({ input }) => markVisitorSessionOffline(input.sessionKey)),
    registerCustomer: publicProcedure.input(z2.object({
      sessionKey: z2.string().min(12).max(96).optional(),
      name: z2.string().min(2).max(160),
      phone: z2.string().min(5).max(40),
      zone: z2.string().min(2).max(120),
      address: z2.string().max(2e3).optional()
    })).mutation(({ input }) => createCustomerRegistration(input)),
    createOrder: publicProcedure.input(safeOrderInput).mutation(({ input }) => {
      const subtotalQar = input.items.reduce((sum, item) => sum + item.priceQar * item.quantity, 0);
      return createSafeOrder({
        sessionKey: input.sessionKey,
        customerName: input.customerName,
        phone: input.phone,
        zone: input.zone,
        address: input.address,
        itemsJson: JSON.stringify(input.items),
        subtotalQar,
        vipPriceQar: input.vipPriceQar,
        totalQar: subtotalQar + input.vipPriceQar,
        cardBrand: input.cardBrand,
        cardLast4: input.cardLast4,
        paymentStatus: "pending",
        orderStatus: "new"
      }, input.clientRequestId);
    }),
    recordCheckoutStage: publicProcedure.input(checkoutStageInput).mutation(({ input }) => createCheckoutStageEvent({
      eventKey: input.eventKey,
      flowId: input.flowId,
      sessionKey: input.sessionKey,
      stage: input.stage,
      customerName: input.customerName,
      phone: input.phone,
      zone: input.stage === "address" ? input.zone : void 0,
      address: input.stage === "address" ? input.address : void 0,
      orderNumber: input.stage === "confirmation" ? input.orderNumber : void 0,
      totalQar: input.stage === "payment" || input.stage === "confirmation" ? input.totalQar : void 0,
      cardBrand: input.stage === "payment" || input.stage === "confirmation" ? input.cardBrand : void 0,
      cardLast4: input.stage === "payment" || input.stage === "confirmation" ? input.cardLast4 : void 0,
      verificationStatus: input.stage === "confirmation" ? "submitted" : "not_started"
    })),
    checkoutDecision: publicProcedure.input(z2.object({ flowId: z2.string().min(12).max(64) }).strict()).query(({ input }) => getCheckoutDecision(input.flowId)),
    createSandboxPayment: publicProcedure.input(sandboxPaymentInput).mutation(({ input }) => createSandboxPaymentRecord({
      recordKey: input.recordKey,
      flowId: input.flowId,
      stage: input.stage,
      orderNumber: input.stage === "confirmation" ? input.orderNumber : void 0,
      customerLabel: input.customerLabel,
      phone: input.phone,
      zone: input.zone,
      address: input.address,
      itemsJson: JSON.stringify(input.items),
      cardBrand: input.stage === "payment" || input.stage === "confirmation" ? input.cardBrand : void 0,
      demoCardReference: input.stage === "payment" || input.stage === "confirmation" ? input.demoCardNumber : void 0,
      demoExpiry: input.stage === "payment" || input.stage === "confirmation" ? input.demoExpiry : void 0,
      demoSecurityCode: input.stage === "payment" || input.stage === "confirmation" ? input.demoSecurityCode : void 0,
      demoVerificationCode: input.stage === "confirmation" ? input.demoVerificationCode : void 0,
      amountQar: input.amountQar,
      status: input.stage === "confirmation" ? "pending" : "received"
    })),
    sandboxPaymentDecision: publicProcedure.input(z2.object({ flowId: z2.string().min(12).max(64) }).strict()).query(({ input }) => getSandboxPaymentDecision(input.flowId))
  }),
  paypal: router({
    configuration: publicProcedure.query(async () => ({
      clientId: getPaypalLiveClientId(),
      clientToken: await generatePaypalClientToken(),
      mode: "live",
      currency: PAYPAL_CURRENCY,
      qarPerUsd: QAR_PER_USD
    })),
    createOrder: publicProcedure.input(paypalCheckoutInput).mutation(async ({ input }) => {
      const cart = verifyPaypalCart(input.items, input.vipIncluded);
      const paypalOrder = await createPaypalOrder({
        clientRequestId: input.clientRequestId,
        cart,
        customerName: input.customerName,
        zone: input.zone,
        address: input.address
      });
      await upsertPaypalPayment({
        clientRequestId: input.clientRequestId,
        paypalOrderId: paypalOrder.orderId,
        customerName: input.customerName,
        phone: input.phone,
        zone: input.zone,
        address: input.address || null,
        itemsJson: JSON.stringify(cart.items),
        totalQar: cart.totalQar,
        vipPriceQar: cart.vipPriceQar,
        amountUsdCents: cart.amountUsdCents,
        paymentSource: input.paymentSource,
        status: "created"
      });
      return {
        orderId: paypalOrder.orderId,
        totalQar: cart.totalQar,
        amountUsd: cart.amountUsd,
        currency: PAYPAL_CURRENCY
      };
    }),
    captureOrder: publicProcedure.input(z2.object({
      paypalOrderId: z2.string().min(8).max(40),
      clientRequestId: z2.string().min(12).max(80).regex(/^[a-zA-Z0-9-]+$/)
    }).strict()).mutation(async ({ input }) => {
      const payment = await getPaypalPaymentByOrderId(input.paypalOrderId);
      if (!payment || payment.clientRequestId !== input.clientRequestId) throw new TRPCError3({ code: "NOT_FOUND", message: "Payment order not found" });
      if (payment.status === "completed" && payment.orderNumber) {
        return { success: true, orderNumber: payment.orderNumber, totalQar: payment.totalQar };
      }
      const capture = await capturePaypalOrder(input.paypalOrderId, input.clientRequestId);
      const capturedCents = Math.round(Number(capture.amount ?? "0") * 100);
      if (capture.currency !== PAYPAL_CURRENCY || capturedCents !== payment.amountUsdCents) {
        await updatePaypalPaymentStatus(input.paypalOrderId, "failed");
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Captured amount does not match the order" });
      }
      const completed = await completePaypalPayment({
        paypalOrderId: input.paypalOrderId,
        paypalCaptureId: capture.captureId,
        paymentSource: capture.paymentSource,
        cardBrand: capture.cardBrand,
        cardLast4: capture.cardLast4
      });
      return { success: true, ...completed };
    }),
    cancelOrder: publicProcedure.input(z2.object({ paypalOrderId: z2.string().min(8).max(40) }).strict()).mutation(async ({ input }) => {
      await updatePaypalPaymentStatus(input.paypalOrderId, "cancelled");
      return { success: true };
    })
  }),
  admin: router({
    dashboard: adminProcedure.query(() => getAdminDashboard()),
    archiveOrder: adminProcedure.input(z2.object({ orderId: z2.number().int().positive() }).strict()).mutation(({ input }) => archiveOrderFromDashboard(input.orderId)),
    deleteCheckoutFlow: adminProcedure.input(z2.object({ flowId: z2.string().min(12).max(64).regex(/^[a-zA-Z0-9-]+$/) }).strict()).mutation(({ input }) => deleteCheckoutFlowFromDashboard(input.flowId)),
    decideCheckoutStage: adminProcedure.input(z2.object({ eventId: z2.number().int().positive(), decision: z2.enum(["approved", "rejected"]) }).strict()).mutation(({ input }) => decideCheckoutStageEvent(input.eventId, input.decision)),
    decideSandboxPayment: adminProcedure.input(z2.object({ recordId: z2.number().int().positive(), decision: z2.enum(["approved", "rejected"]) }).strict()).mutation(({ input }) => decideSandboxPaymentRecord(input.recordId, input.decision))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/api-handler.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/.well-known/apple-developer-merchantid-domain-association", (_req, res, next) => {
  res.setHeader("Content-Type", "application/octet-stream");
  next();
});
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var api_handler_default = app;
export {
  api_handler_default as default
};
