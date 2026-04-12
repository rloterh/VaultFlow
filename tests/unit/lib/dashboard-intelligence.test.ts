import { describe, expect, it } from "vitest";
import { buildDashboardIntelligenceSnapshot } from "@/lib/operations/dashboard-intelligence";

type DashboardInput = Parameters<typeof buildDashboardIntelligenceSnapshot>[0];

function buildActivity(
  action: string,
  createdAt: string
): DashboardInput["activity"][number] {
  return {
    id: `${action}-${createdAt}`,
    org_id: "org-1",
    user_id: "user-1",
    entity_type: "invoice",
    entity_id: "entity-1",
    action,
    metadata: {},
    created_at: createdAt,
  };
}

describe("dashboard intelligence", () => {
  it("surfaces clustered payment failures, overdue concentration, and stale recovery", () => {
    const referenceDate = new Date("2026-04-12T00:00:00.000Z");
    const input: DashboardInput = {
      referenceDate,
      scopeLabel: "workspace",
      clients: [
        { id: "client-acme", name: "Acme" },
        { id: "client-bravo", name: "Bravo" },
      ],
      invoices: [
        {
          client_id: "client-acme",
          status: "overdue",
          total: 10000,
          amount_paid: 2000,
          due_date: "2026-04-05",
          paid_at: null,
          voided_at: null,
          last_recovery_reviewed_at: null,
        },
        {
          client_id: "client-acme",
          status: "overdue",
          total: 6000,
          amount_paid: 0,
          due_date: "2026-04-01",
          paid_at: null,
          voided_at: null,
          last_recovery_reviewed_at: "2026-03-29T00:00:00.000Z",
        },
        {
          client_id: "client-bravo",
          status: "sent",
          total: 4000,
          amount_paid: 0,
          due_date: "2026-04-15",
          paid_at: null,
          voided_at: null,
          last_recovery_reviewed_at: null,
        },
        {
          client_id: "client-bravo",
          status: "paid",
          total: 9000,
          amount_paid: 9000,
          due_date: "2026-04-02",
          paid_at: "2026-04-02T00:00:00.000Z",
          voided_at: null,
          last_recovery_reviewed_at: null,
        },
      ],
      activity: [
        buildActivity("payment_failed", "2026-04-10T00:00:00.000Z"),
        buildActivity("payment_failed", "2026-04-06T00:00:00.000Z"),
      ],
    };

    const snapshot = buildDashboardIntelligenceSnapshot(input);

    expect(snapshot.forecastMetrics.map((metric) => metric.label)).toEqual([
      "30-day cash forecast",
      "Due-soon exposure",
      "Recovery freshness",
    ]);
    expect(snapshot.forecastMetrics[1]?.detail).toContain("1 open invoice");
    expect(snapshot.alerts.map((alert) => alert.id)).toEqual([
      "payment-failures",
      "overdue-concentration",
      "stale-recovery",
    ]);
    expect(snapshot.alerts[1]?.href).toBe("/dashboard/clients/client-acme");
  });

  it("falls back to a stable posture when no major anomalies are present", () => {
    const snapshot = buildDashboardIntelligenceSnapshot({
      referenceDate: new Date("2026-04-12T00:00:00.000Z"),
      scopeLabel: "reporting slice",
      clients: [{ id: "client-steady", name: "Steady Co" }],
      invoices: [
        {
          client_id: "client-steady",
          status: "paid",
          total: 5000,
          amount_paid: 5000,
          due_date: "2026-04-01",
          paid_at: "2026-04-01T00:00:00.000Z",
          voided_at: null,
          last_recovery_reviewed_at: null,
        },
      ],
      activity: [],
    });

    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0]?.id).toBe("stable-posture");
    expect(snapshot.alerts[0]?.tone).toBe("success");
    expect(snapshot.forecastMetrics[2]?.value).toBe("Current");
  });
});
