import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const visitorSessions = mysqlTable("visitor_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }).notNull().unique(),
  currentPath: varchar("currentPath", { length: 255 }).notNull().default("/"),
  userAgent: varchar("userAgent", { length: 512 }),
  isActive: int("isActive").notNull().default(1),
  pageViews: int("pageViews").notNull().default(1),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ sessionKeyIdx: uniqueIndex("visitor_sessions_session_key_idx").on(table.sessionKey) }));

export const customerRegistrations = mysqlTable("customer_registrations", {
  id: int("id").autoincrement().primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  status: mysqlEnum("status", ["new", "contacted", "archived"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  registrationId: int("registrationId"),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  subtotalQar: int("subtotalQar").notNull(),
  vipPriceQar: int("vipPriceQar").notNull().default(0),
  totalQar: int("totalQar").notNull(),
  cardBrand: varchar("cardBrand", { length: 20 }).notNull(),
  cardLast4: varchar("cardLast4", { length: 4 }).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "verified", "failed"]).default("verified").notNull(),
  orderStatus: mysqlEnum("orderStatus", ["new", "processing", "completed", "archived"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber) }));

export const paypalPayments = mysqlTable("paypal_payments", {
  id: int("id").autoincrement().primaryKey(),
  clientRequestId: varchar("clientRequestId", { length: 80 }).notNull().unique(),
  paypalOrderId: varchar("paypalOrderId", { length: 40 }).notNull().unique(),
  paypalCaptureId: varchar("paypalCaptureId", { length: 40 }).unique(),
  orderNumber: varchar("orderNumber", { length: 32 }).unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  totalQar: int("totalQar").notNull(),
  vipPriceQar: int("vipPriceQar").notNull().default(0),
  amountUsdCents: int("amountUsdCents").notNull(),
  paymentSource: mysqlEnum("paymentSource", ["paypal", "apple_pay", "google_pay", "card"]).notNull().default("card"),
  status: mysqlEnum("status", ["created", "approved", "completed", "cancelled", "failed"]).notNull().default("created"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const checkoutStageEvents = mysqlTable("checkout_stage_events", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 96 }).notNull().unique(),
  flowId: varchar("flowId", { length: 64 }).notNull(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  stage: mysqlEnum("stage", ["address", "payment", "confirmation"]).notNull(),
  customerName: varchar("customerName", { length: 160 }),
  phone: varchar("phone", { length: 40 }),
  zone: varchar("zone", { length: 120 }),
  address: text("address"),
  orderNumber: varchar("orderNumber", { length: 32 }),
  totalQar: int("totalQar"),
  cardBrand: varchar("cardBrand", { length: 20 }),
  cardLast4: varchar("cardLast4", { length: 4 }),
  verificationStatus: mysqlEnum("verificationStatus", ["not_started", "submitted", "approved", "rejected"]).default("not_started").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ eventKeyIdx: uniqueIndex("checkout_stage_events_event_key_idx").on(table.eventKey) }));

export const sandboxPaymentRecords = mysqlTable("sandbox_payment_records", {
  id: int("id").autoincrement().primaryKey(),
  recordKey: varchar("recordKey", { length: 96 }).notNull().unique(),
  flowId: varchar("flowId", { length: 64 }).notNull(),
  demoReference: varchar("demoReference", { length: 40 }),
  stage: mysqlEnum("stage", ["payment", "confirmation"]).notNull(),
  orderNumber: varchar("orderNumber", { length: 32 }),
  customerLabel: varchar("customerLabel", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  itemsJson: text("itemsJson").notNull(),
  cardBrand: mysqlEnum("cardBrand", ["visa", "mastercard", "mada"]),
  demoCardReference: varchar("demoCardReference", { length: 48 }),
  demoExpiry: varchar("demoExpiry", { length: 5 }),
  demoSecurityCode: varchar("demoSecurityCode", { length: 20 }),
  demoVerificationCode: varchar("demoVerificationCode", { length: 24 }),
  amountQar: int("amountQar").notNull().default(0),
  status: mysqlEnum("status", ["received", "pending", "approved", "rejected"]).default("received").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ recordKeyIdx: uniqueIndex("sandbox_payment_records_record_key_idx").on(table.recordKey) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type VisitorSession = typeof visitorSessions.$inferSelect;
export type CustomerRegistration = typeof customerRegistrations.$inferSelect;
export type InsertCustomerRegistration = typeof customerRegistrations.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type PaypalPayment = typeof paypalPayments.$inferSelect;
export type InsertPaypalPayment = typeof paypalPayments.$inferInsert;
export type CheckoutStageEvent = typeof checkoutStageEvents.$inferSelect;
export type InsertCheckoutStageEvent = typeof checkoutStageEvents.$inferInsert;
export type SandboxPaymentRecord = typeof sandboxPaymentRecords.$inferSelect;
export type InsertSandboxPaymentRecord = typeof sandboxPaymentRecords.$inferInsert;
