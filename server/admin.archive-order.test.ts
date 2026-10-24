import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { archiveOrderFromDashboardMock, deleteCheckoutFlowFromDashboardMock } = vi.hoisted(() => ({
  archiveOrderFromDashboardMock: vi.fn(async (orderId: number) => ({
    id: orderId,
    orderNumber: "QC-ARCHIVE-TEST",
    orderStatus: "archived" as const,
  })),
  deleteCheckoutFlowFromDashboardMock: vi.fn(async (flowId: string) => ({ success: true as const, flowId })),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, archiveOrderFromDashboard: archiveOrderFromDashboardMock, deleteCheckoutFlowFromDashboard: deleteCheckoutFlowFromDashboardMock };
});

import { appRouter } from "./routers";

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: role === "admin" ? "owner" : "customer",
      name: "Qatar Curves",
      email: "owner@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.archiveOrder", () => {
  beforeEach(() => {
    archiveOrderFromDashboardMock.mockClear();
    deleteCheckoutFlowFromDashboardMock.mockClear();
  });

  it("rejects non-admin users without touching the order", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.archiveOrder({ orderId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(archiveOrderFromDashboardMock).not.toHaveBeenCalled();
  });

  it("archives the selected order for an admin", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.admin.archiveOrder({ orderId: 7 })).resolves.toEqual({
      id: 7,
      orderNumber: "QC-ARCHIVE-TEST",
      orderStatus: "archived",
    });
    expect(archiveOrderFromDashboardMock).toHaveBeenCalledOnce();
    expect(archiveOrderFromDashboardMock).toHaveBeenCalledWith(7);
  });

  it("rejects invalid order ids before calling the database", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.admin.archiveOrder({ orderId: 0 })).rejects.toBeTruthy();
    expect(archiveOrderFromDashboardMock).not.toHaveBeenCalled();
  });

  it("deletes one checkout notification flow for an admin", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.admin.deleteCheckoutFlow({ flowId: "checkout-flow-123456" })).resolves.toEqual({ success: true, flowId: "checkout-flow-123456" });
    expect(deleteCheckoutFlowFromDashboardMock).toHaveBeenCalledWith("checkout-flow-123456");
  });

  it("rejects checkout flow deletion for non-admin users", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.deleteCheckoutFlow({ flowId: "checkout-flow-123456" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteCheckoutFlowFromDashboardMock).not.toHaveBeenCalled();
  });
});
