import type { IncomingMessage, ServerResponse } from "http";

let appPromise: Promise<any> | null = null;

function initApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const express = (await import("express")).default;
      const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
      const { registerOAuthRoutes } = await import("../server/_core/oauth.js");
      const { registerStorageProxy } = await import("../server/_core/storageProxy.js");
      const { appRouter } = await import("../server/routers.js");
      const { createContext } = await import("../server/_core/context.js");

      const app = express();
      app.use(express.json({ limit: "50mb" }));
      app.use(express.urlencoded({ limit: "50mb", extended: true }));

      registerStorageProxy(app);
      registerOAuthRoutes(app);

      app.use(
        "/api/trpc",
        createExpressMiddleware({ router: appRouter, createContext })
      );

      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await initApp();
    return app(req, res);
  } catch (err: any) {
    const body = JSON.stringify({
      error: "API init failed",
      message: err?.message ?? String(err),
      stack: err?.stack,
    });
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(body);
  }
}
