export const ENV = {
  appId: process.env.VITE_APP_ID || "qatar-curves",
  cookieSecret: process.env.JWT_SECRET || "qatarcurves-jwt-secret-2026-x9k2m",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres.oceuvnmfkkesyjgomwip:8%25Vi2%2BysgG3dqWu@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
