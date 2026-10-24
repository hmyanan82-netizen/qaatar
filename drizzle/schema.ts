import { integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const registrationStatusEnum = pgEnum("registration_status", ["new", "contacted", "archived"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "failed"]);
export const orderStatusEnum = pgEnum("order_status", ["new", "processing", "completed", "archived"]);
export const paymentSourceEnum = pgEnum("payment_source", ["paypal", "apple_pay", "google_pay", "card"]);
export const paypalStatusEnum = pgEnum("paypal_status", ["created", "approved", "completed", "cancelled", "failed"]);
export const checkoutStageEnum = pgEnum("checkout_stage", ["address", "payment", "confirmation"]);
export const verificationStatusEnum = pgEnum("verification_status", ["not_started", "submitted", "approved", "rejected"]);
export const sandboxStageEnum = pgEnum("sandbox_stage", ["payment", "confirmation"]);
export const cardBrandEnum = pgEnum("card_brand", ["visa", "mastercard", "mada"]);
export const sandboxStatusEnum = pgEnum("sandbox_status", ["received", "pending", "approved", "rejected"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const visitorSessions = pgTable("visitor_sessions", {
  id: serial("id").primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }).notNull().unique(),
  currentPath: varchar("currentPath", { length: 255 }).notNull().default("/"),
  userAgent: varchar("userAgent", { length: 512 }),
  isActive: integer("isActive").notNull().default(1),
  pageViews: integer("pageViews").notNull().default(1),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
}, (table) => ({ sessionKeyIdx: uniqueIndex("visitor_sessions_session_key_idx").on(table.sessionKey) }));

export const customerRegistrations = pgTable("customer_registrations", {
  id: serial("id").primaryKey(),
  sessionKey: varchar("sessionKey", { length: 96 }),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  zone: varchar("zone", { length: 120 }).notNull(),
  address: text("address"),
  status: registrationStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber) }));

export const paypalPayments = pgTable("paypal_payments", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const checkoutStageEvents = pgTable("checkout_stage_events", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ eventKeyIdx: uniqueIndex("checkout_stage_events_event_key_idx").on(table.eventKey) }));

export const sandboxPaymentRecords = pgTable("sandbox_payment_records", {
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
