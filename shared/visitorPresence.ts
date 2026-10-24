export const VISITOR_HEARTBEAT_MS = 15_000;
export const VISITOR_ONLINE_WINDOW_MS = 45_000;
export const VISITOR_SESSION_KEY = "qatar-curves-visitor-session";

export function shouldTrackVisitorPath(pathname: string): boolean {
  return !/^\/(dashboard|owner)(\/|$)/.test(pathname);
}

export function isVisitorOnline(isActive: number | boolean, lastSeenAt: Date, now = Date.now()): boolean {
  return Boolean(isActive) && now - lastSeenAt.getTime() < VISITOR_ONLINE_WINDOW_MS;
}
