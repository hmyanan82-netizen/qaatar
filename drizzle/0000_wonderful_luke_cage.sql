CREATE TYPE "public"."card_brand" AS ENUM('visa', 'mastercard', 'mada');--> statement-breakpoint
CREATE TYPE "public"."checkout_stage" AS ENUM('address', 'payment', 'confirmation');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'processing', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payment_source" AS ENUM('paypal', 'apple_pay', 'google_pay', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."paypal_status" AS ENUM('created', 'approved', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('new', 'contacted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."sandbox_stage" AS ENUM('payment', 'confirmation');--> statement-breakpoint
CREATE TYPE "public"."sandbox_status" AS ENUM('received', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('not_started', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "checkout_stage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventKey" varchar(96) NOT NULL,
	"flowId" varchar(64) NOT NULL,
	"sessionKey" varchar(96),
	"stage" "checkout_stage" NOT NULL,
	"customerName" varchar(160),
	"phone" varchar(40),
	"zone" varchar(120),
	"address" text,
	"orderNumber" varchar(32),
	"totalQar" integer,
	"cardBrand" varchar(20),
	"cardLast4" varchar(4),
	"verificationStatus" "verification_status" DEFAULT 'not_started' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_stage_events_eventKey_unique" UNIQUE("eventKey")
);
--> statement-breakpoint
CREATE TABLE "customer_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionKey" varchar(96),
	"name" varchar(160) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"zone" varchar(120) NOT NULL,
	"address" text,
	"status" "registration_status" DEFAULT 'new' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderNumber" varchar(32) NOT NULL,
	"sessionKey" varchar(96),
	"registrationId" integer,
	"customerName" varchar(160) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"zone" varchar(120) NOT NULL,
	"address" text,
	"itemsJson" text NOT NULL,
	"subtotalQar" integer NOT NULL,
	"vipPriceQar" integer DEFAULT 0 NOT NULL,
	"totalQar" integer NOT NULL,
	"cardBrand" varchar(20) NOT NULL,
	"cardLast4" varchar(4) NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'verified' NOT NULL,
	"orderStatus" "order_status" DEFAULT 'new' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE "paypal_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientRequestId" varchar(80) NOT NULL,
	"paypalOrderId" varchar(40) NOT NULL,
	"paypalCaptureId" varchar(40),
	"orderNumber" varchar(32),
	"customerName" varchar(160) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"zone" varchar(120) NOT NULL,
	"address" text,
	"itemsJson" text NOT NULL,
	"totalQar" integer NOT NULL,
	"vipPriceQar" integer DEFAULT 0 NOT NULL,
	"amountUsdCents" integer NOT NULL,
	"paymentSource" "payment_source" DEFAULT 'card' NOT NULL,
	"status" "paypal_status" DEFAULT 'created' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_payments_clientRequestId_unique" UNIQUE("clientRequestId"),
	CONSTRAINT "paypal_payments_paypalOrderId_unique" UNIQUE("paypalOrderId"),
	CONSTRAINT "paypal_payments_paypalCaptureId_unique" UNIQUE("paypalCaptureId"),
	CONSTRAINT "paypal_payments_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE "sandbox_payment_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"recordKey" varchar(96) NOT NULL,
	"flowId" varchar(64) NOT NULL,
	"demoReference" varchar(40),
	"stage" "sandbox_stage" NOT NULL,
	"orderNumber" varchar(32),
	"customerLabel" varchar(120) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"zone" varchar(120) NOT NULL,
	"address" text,
	"itemsJson" text NOT NULL,
	"cardBrand" "card_brand",
	"demoCardReference" varchar(48),
	"demoExpiry" varchar(5),
	"demoSecurityCode" varchar(20),
	"demoVerificationCode" varchar(24),
	"amountQar" integer DEFAULT 0 NOT NULL,
	"status" "sandbox_status" DEFAULT 'received' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_payment_records_recordKey_unique" UNIQUE("recordKey")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "visitor_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionKey" varchar(96) NOT NULL,
	"currentPath" varchar(255) DEFAULT '/' NOT NULL,
	"userAgent" varchar(512),
	"isActive" integer DEFAULT 1 NOT NULL,
	"pageViews" integer DEFAULT 1 NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_sessions_sessionKey_unique" UNIQUE("sessionKey")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_stage_events_event_key_idx" ON "checkout_stage_events" USING btree ("eventKey");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("orderNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_payment_records_record_key_idx" ON "sandbox_payment_records" USING btree ("recordKey");--> statement-breakpoint
CREATE UNIQUE INDEX "visitor_sessions_session_key_idx" ON "visitor_sessions" USING btree ("sessionKey");