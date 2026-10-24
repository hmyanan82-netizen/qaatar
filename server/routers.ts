import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { archiveOrderFromDashboard, completePaypalPayment, createCheckoutStageEvent, createCustomerRegistration, createSafeOrder, createSandboxPaymentRecord, decideCheckoutStageEvent, decideSandboxPaymentRecord, deleteCheckoutFlowFromDashboard, getAdminDashboard, getCheckoutDecision, getPaypalPaymentByOrderId, getSandboxPaymentDecision, markVisitorSessionOffline, updatePaypalPaymentStatus, upsertPaypalPayment, upsertVisitorSession, upsertUser } from "./db";
import { capturePaypalOrder, createPaypalOrder, generatePaypalClientToken, getPaypalLiveClientId, PAYPAL_CURRENCY, QAR_PER_USD, verifyPaypalCart } from "./paypal";
import { sdk } from "./_core/sdk";

const visitorInput = z.object({
  sessionKey: z.string().min(12).max(96),
  currentPath: z.string().max(255).default("/"),
  userAgent: z.string().max(512).optional(),
});

export const safeOrderInput = z.object({
  clientRequestId: z.string().regex(/^[a-zA-Z0-9-]{12,64}$/).optional(),
  sessionKey: z.string().min(12).max(96).optional(),
  customerName: z.string().min(2).max(160),
  phone: z.string().min(5).max(40),
  zone: z.string().min(2).max(120),
  address: z.string().max(2000).optional(),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(20),
    size: z.string().max(30),
    color: z.string().max(30).optional(),
    priceQar: z.number().int().min(0).max(100000),
  }).strict()).min(1).max(50),
  vipPriceQar: z.number().int().min(0).max(100000).default(0),
  cardBrand: z.enum(["visa", "mastercard", "mada"]),
  cardLast4: z.string().regex(/^\d{4}$/),
}).strict();

export const paypalCheckoutInput = z.object({
  clientRequestId: z.string().min(12).max(80).regex(/^[a-zA-Z0-9-]+$/),
  customerName: z.string().min(2).max(160),
  phone: z.string().min(5).max(40),
  zone: z.string().min(2).max(120),
  address: z.string().max(1000).optional(),
  items: z.array(z.object({
    name: z.string().min(2).max(160),
    quantity: z.number().int().min(1).max(10),
    size: z.string().min(1).max(40),
    color: z.string().max(40).optional(),
  }).strict()).max(20),
  vipIncluded: z.boolean().default(false),
  paymentSource: z.enum(["paypal", "apple_pay", "google_pay", "card"]).default("card"),
}).strict();

export const checkoutStageInput = z.discriminatedUnion("stage", [
  z.object({
    stage: z.literal("address"), eventKey: z.string().min(12).max(96), flowId: z.string().min(12).max(64), sessionKey: z.string().min(12).max(96).optional(),
    customerName: z.string().min(2).max(160), phone: z.string().min(5).max(40), zone: z.string().min(2).max(120), address: z.string().max(2000).optional(),
  }).strict(),
  z.object({
    stage: z.literal("payment"), eventKey: z.string().min(12).max(96), flowId: z.string().min(12).max(64), sessionKey: z.string().min(12).max(96).optional(),
    customerName: z.string().min(2).max(160), phone: z.string().min(5).max(40), totalQar: z.number().int().min(0).max(500000), cardBrand: z.enum(["visa", "mastercard", "mada"]), cardLast4: z.string().regex(/^\d{4}$/),
  }).strict(),
  z.object({
    stage: z.literal("confirmation"), eventKey: z.string().min(12).max(96), flowId: z.string().min(12).max(64), sessionKey: z.string().min(12).max(96).optional(),
    customerName: z.string().min(2).max(160), phone: z.string().min(5).max(40), orderNumber: z.string().min(4).max(32), totalQar: z.number().int().min(0).max(500000), cardBrand: z.enum(["visa", "mastercard", "mada"]), cardLast4: z.string().regex(/^\d{4}$/),
  }).strict(),
]);

const sandboxBase = {
  recordKey: z.string().regex(/^[a-zA-Z0-9-]{12,96}$/),
  flowId: z.string().regex(/^[a-zA-Z0-9-]{12,64}$/),
  customerLabel: z.string().min(2).max(120),
  phone: z.string().min(5).max(40),
  zone: z.string().min(2).max(120),
  address: z.string().max(2000).optional(),
  items: z.array(z.object({ name: z.string().min(1).max(200), quantity: z.number().int().min(1).max(20), size: z.string().max(30), color: z.string().max(30).optional(), priceQar: z.number().int().min(0).max(100000) }).strict()).min(1).max(50),
  amountQar: z.number().int().min(0).max(500000),
};
const sandboxCardFields = {
  cardBrand: z.enum(["visa", "mastercard", "mada"]),
  demoCardNumber: z.string().regex(/^\d{16}$/),
  demoExpiry: z.string().regex(/^(0[1-9]|1[0-2])\/([2-9][0-9])$/),
  demoSecurityCode: z.string().regex(/^\d{3,4}$/),
};
export const sandboxPaymentInput = z.discriminatedUnion("stage", [
  z.object({ ...sandboxBase, ...sandboxCardFields, stage: z.literal("payment") }).strict(),
  z.object({ ...sandboxBase, ...sandboxCardFields, stage: z.literal("confirmation"), orderNumber: z.string().regex(/^DEMO-[A-Z0-9-]{6,26}$/), demoVerificationCode: z.string().regex(/^\d{6}$/) }).strict(),
]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginWithPassword: publicProcedure.input(z.object({ password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || "Qatar2026Admin";
      if (!adminPassword) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin password not configured" });
      if (input.password !== adminPassword) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور غير صحيحة" });
      const openId = "admin-owner";
      await upsertUser({ openId, name: "Admin", role: "admin", lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(openId, { name: "Admin", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true as const, token, cookieName: COOKIE_NAME };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  analytics: router({
    heartbeat: publicProcedure.input(visitorInput).mutation(({ input }) => upsertVisitorSession(input)),
    leave: publicProcedure.input(z.object({ sessionKey: z.string().min(12).max(96) }).strict()).mutation(({ input }) => markVisitorSessionOffline(input.sessionKey)),
    registerCustomer: publicProcedure.input(z.object({
      sessionKey: z.string().min(12).max(96).optional(),
      name: z.string().min(2).max(160),
      phone: z.string().min(5).max(40),
      zone: z.string().min(2).max(120),
      address: z.string().max(2000).optional(),
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
        orderStatus: "new",
      }, input.clientRequestId);
    }),
    recordCheckoutStage: publicProcedure.input(checkoutStageInput).mutation(({ input }) => createCheckoutStageEvent({
      eventKey: input.eventKey,
      flowId: input.flowId,
      sessionKey: input.sessionKey,
      stage: input.stage,
      customerName: input.customerName,
      phone: input.phone,
      zone: input.stage === "address" ? input.zone : undefined,
      address: input.stage === "address" ? input.address : undefined,
      orderNumber: input.stage === "confirmation" ? input.orderNumber : undefined,
      totalQar: input.stage === "payment" || input.stage === "confirmation" ? input.totalQar : undefined,
      cardBrand: input.stage === "payment" || input.stage === "confirmation" ? input.cardBrand : undefined,
      cardLast4: input.stage === "payment" || input.stage === "confirmation" ? input.cardLast4 : undefined,
      verificationStatus: input.stage === "confirmation" ? "submitted" : "not_started",
    })),
    checkoutDecision: publicProcedure.input(z.object({ flowId: z.string().min(12).max(64) }).strict()).query(({ input }) => getCheckoutDecision(input.flowId)),
    createSandboxPayment: publicProcedure.input(sandboxPaymentInput).mutation(({ input }) => createSandboxPaymentRecord({
      recordKey: input.recordKey,
      flowId: input.flowId,
      stage: input.stage,
      orderNumber: input.stage === "confirmation" ? input.orderNumber : undefined,
      customerLabel: input.customerLabel,
      phone: input.phone,
      zone: input.zone,
      address: input.address,
      itemsJson: JSON.stringify(input.items),
      cardBrand: input.stage === "payment" || input.stage === "confirmation" ? input.cardBrand : undefined,
      demoCardReference: input.stage === "payment" || input.stage === "confirmation" ? input.demoCardNumber : undefined,
      demoExpiry: input.stage === "payment" || input.stage === "confirmation" ? input.demoExpiry : undefined,
      demoSecurityCode: input.stage === "payment" || input.stage === "confirmation" ? input.demoSecurityCode : undefined,
      demoVerificationCode: input.stage === "confirmation" ? input.demoVerificationCode : undefined,
      amountQar: input.amountQar,
      status: input.stage === "confirmation" ? "pending" : "received",
    })),
    sandboxPaymentDecision: publicProcedure.input(z.object({ flowId: z.string().min(12).max(64) }).strict()).query(({ input }) => getSandboxPaymentDecision(input.flowId)),
  }),
  paypal: router({
    configuration: publicProcedure.query(async () => ({
      clientId: getPaypalLiveClientId(),
      clientToken: await generatePaypalClientToken(),
      mode: "live" as const,
      currency: PAYPAL_CURRENCY,
      qarPerUsd: QAR_PER_USD,
    })),
    createOrder: publicProcedure.input(paypalCheckoutInput).mutation(async ({ input }) => {
      const cart = verifyPaypalCart(input.items, input.vipIncluded);
      const paypalOrder = await createPaypalOrder({
        clientRequestId: input.clientRequestId,
        cart,
        customerName: input.customerName,
        zone: input.zone,
        address: input.address,
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
        status: "created",
      });
      return {
        orderId: paypalOrder.orderId,
        totalQar: cart.totalQar,
        amountUsd: cart.amountUsd,
        currency: PAYPAL_CURRENCY,
      };
    }),
    captureOrder: publicProcedure.input(z.object({
      paypalOrderId: z.string().min(8).max(40),
      clientRequestId: z.string().min(12).max(80).regex(/^[a-zA-Z0-9-]+$/),
    }).strict()).mutation(async ({ input }) => {
      const payment = await getPaypalPaymentByOrderId(input.paypalOrderId);
      if (!payment || payment.clientRequestId !== input.clientRequestId) throw new TRPCError({ code: "NOT_FOUND", message: "Payment order not found" });
      if (payment.status === "completed" && payment.orderNumber) {
        return { success: true as const, orderNumber: payment.orderNumber, totalQar: payment.totalQar };
      }

      const capture = await capturePaypalOrder(input.paypalOrderId, input.clientRequestId);
      const capturedCents = Math.round(Number(capture.amount ?? "0") * 100);
      if (capture.currency !== PAYPAL_CURRENCY || capturedCents !== payment.amountUsdCents) {
        await updatePaypalPaymentStatus(input.paypalOrderId, "failed");
        throw new TRPCError({ code: "BAD_REQUEST", message: "Captured amount does not match the order" });
      }

      const completed = await completePaypalPayment({
        paypalOrderId: input.paypalOrderId,
        paypalCaptureId: capture.captureId,
        paymentSource: capture.paymentSource,
        cardBrand: capture.cardBrand,
        cardLast4: capture.cardLast4,
      });
      return { success: true as const, ...completed };
    }),
    cancelOrder: publicProcedure.input(z.object({ paypalOrderId: z.string().min(8).max(40) }).strict()).mutation(async ({ input }) => {
      await updatePaypalPaymentStatus(input.paypalOrderId, "cancelled");
      return { success: true as const };
    }),
  }),
  admin: router({
    dashboard: adminProcedure.query(() => getAdminDashboard()),
    archiveOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive() }).strict()).mutation(({ input }) => archiveOrderFromDashboard(input.orderId)),
    deleteCheckoutFlow: adminProcedure.input(z.object({ flowId: z.string().min(12).max(64).regex(/^[a-zA-Z0-9-]+$/) }).strict()).mutation(({ input }) => deleteCheckoutFlowFromDashboard(input.flowId)),
    decideCheckoutStage: adminProcedure.input(z.object({ eventId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) }).strict()).mutation(({ input }) => decideCheckoutStageEvent(input.eventId, input.decision)),
    decideSandboxPayment: adminProcedure.input(z.object({ recordId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) }).strict()).mutation(({ input }) => decideSandboxPaymentRecord(input.recordId, input.decision)),
  }),
});

export type AppRouter = typeof appRouter;
