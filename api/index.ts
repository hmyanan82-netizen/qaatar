import "dotenv/config";

let app: any;
let initError: Error | null = null;

try {
  const express = await import("express");
  const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
  const { registerOAuthRoutes } = await import("../server/_core/oauth");
  const { registerStorageProxy } = await import("../server/_core/storageProxy");
  const { appRouter } = await import("../server/routers");
  const { createContext } = await import("../server/_core/context");

  app = express.default();

  app.use(express.default.json({ limit: "50mb" }));
  app.use(express.default.urlencoded({ limit: "50mb", extended: true }));

  app.use("/.well-known/apple-developer-merchantid-domain-association", (_req: any, res: any, next: any) => {
    res.setHeader("Content-Type", "application/octet-stream");
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
} catch (err: any) {
  initError = err;
  console.error("[API INIT ERROR]", err);
}

export default function handler(req: any, res: any) {
  if (initError || !app) {
    res.status(500).json({
      error: "Server initialization failed",
      message: initError?.message || "Unknown error",
      stack: process.env.NODE_ENV !== "production" ? initError?.stack : undefined,
    });
    return;
  }
  return app(req, res);
}
