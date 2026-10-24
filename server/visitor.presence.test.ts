import { describe, expect, it } from "vitest";
import { isVisitorOnline, shouldTrackVisitorPath, VISITOR_HEARTBEAT_MS, VISITOR_ONLINE_WINDOW_MS } from "../shared/visitorPresence";

describe("visitor live presence", () => {
  const now = new Date("2026-09-25T08:00:00Z").getTime();

  it("counts only an active visitor with a recent heartbeat", () => {
    expect(isVisitorOnline(1, new Date(now - 10_000), now)).toBe(true);
  });

  it("removes a visitor immediately after an explicit leave", () => {
    expect(isVisitorOnline(0, new Date(now), now)).toBe(false);
  });

  it("removes a visitor automatically when heartbeats stop", () => {
    expect(isVisitorOnline(1, new Date(now - VISITOR_ONLINE_WINDOW_MS), now)).toBe(false);
    expect(VISITOR_HEARTBEAT_MS).toBeLessThan(VISITOR_ONLINE_WINDOW_MS);
  });

  it("tracks storefront pages but excludes owner dashboards", () => {
    expect(shouldTrackVisitorPath("/")).toBe(true);
    expect(shouldTrackVisitorPath("/product/curves-6152")).toBe(true);
    expect(shouldTrackVisitorPath("/checkout/payment")).toBe(true);
    expect(shouldTrackVisitorPath("/dashboard")).toBe(false);
    expect(shouldTrackVisitorPath("/dashboard/orders")).toBe(false);
    expect(shouldTrackVisitorPath("/owner")).toBe(false);
  });
});
