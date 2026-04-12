import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClientAccountSignalsSnapshot } from "@/lib/clients/account-signals";

type AccountSignalsInput = Parameters<typeof buildClientAccountSignalsSnapshot>[0];

describe("client account signals", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes finance managers into billing-first intervention paths", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:00:00.000Z"));

    const snapshot = buildClientAccountSignalsSnapshot({
      role: "finance_manager",
      scopeLabel: "client workspace",
      accounts: [
        {
          id: "client-acme",
          name: "Acme",
          company: "Acme Inc",
          total_revenue: 120000,
          snapshot: {
            health: "at-risk",
            healthLabel: "At Risk",
            pendingTotal: 2000,
            overdueTotal: 30000,
            openInvoices: 3,
          },
          collections: {
            openInvoices: 3,
            needsTouch: 2,
            overdue: 3,
            unreminded: 0,
            latestReminderAt: "2026-04-09T00:00:00.000Z",
            totalOutstanding: 32000,
          },
        },
        {
          id: "client-bravo",
          name: "Bravo",
          company: "Bravo LLC",
          total_revenue: 50000,
          snapshot: {
            health: "attention",
            healthLabel: "Attention",
            pendingTotal: 12000,
            overdueTotal: 0,
            openInvoices: 2,
          },
          collections: {
            openInvoices: 2,
            needsTouch: 2,
            overdue: 0,
            unreminded: 2,
            latestReminderAt: null,
            totalOutstanding: 12000,
          },
        },
      ],
    } satisfies AccountSignalsInput);

    expect(snapshot.tone).toBe("danger");
    expect(snapshot.signals[0]?.id).toBe("overdue-account");
    expect(snapshot.signals[0]?.routeLabel).toBe("Open billing recovery");
    expect(snapshot.signals[0]?.routeHref).toBe("/settings/billing?recovery=overdue");
    expect(snapshot.signals[1]?.id).toBe("stale-touch-account");
    expect(snapshot.signals[1]?.routeLabel).toBe("Open finance priority queue");
  });

  it("keeps vendor actions assignment-scoped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:00:00.000Z"));

    const snapshot = buildClientAccountSignalsSnapshot({
      role: "vendor",
      scopeLabel: "assigned portfolio",
      accounts: [
        {
          id: "client-vendor",
          name: "Vendor Scoped Co",
          company: null,
          total_revenue: 18000,
          snapshot: {
            health: "attention",
            healthLabel: "Attention",
            pendingTotal: 11000,
            overdueTotal: 0,
            openInvoices: 2,
          },
          collections: {
            openInvoices: 2,
            needsTouch: 2,
            overdue: 0,
            unreminded: 2,
            latestReminderAt: null,
            totalOutstanding: 11000,
          },
        },
      ],
    } satisfies AccountSignalsInput);

    expect(snapshot.signals[0]?.actionLabel).toBe("Open assigned account");
    expect(snapshot.signals[0]?.routeLabel).toBe("Open assigned workspace");
    expect(snapshot.signals[0]?.routeHref).toContain("/dashboard/clients?");
    expect(snapshot.signals[0]?.handoffDetail).toContain("internal");
  });

  it("falls back to a stable monitored posture when no risk signals are active", () => {
    const snapshot = buildClientAccountSignalsSnapshot({
      role: "viewer",
      accounts: [
        {
          id: "client-steady",
          name: "Steady Co",
          company: "Steady Co",
          total_revenue: 90000,
          snapshot: {
            health: "healthy",
            healthLabel: "Healthy",
            pendingTotal: 0,
            overdueTotal: 0,
            openInvoices: 0,
          },
          collections: {
            openInvoices: 0,
            needsTouch: 0,
            overdue: 0,
            unreminded: 0,
            latestReminderAt: "2026-04-11T00:00:00.000Z",
            totalOutstanding: 0,
          },
        },
      ],
    } satisfies AccountSignalsInput);

    expect(snapshot.tone).toBe("success");
    expect(snapshot.signals[0]?.id).toBe("stable-account");
    expect(snapshot.signals[0]?.routeLabel).toBe("Open reports");
  });
});
