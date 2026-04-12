import { describe, expect, it, vi, afterEach } from "vitest";
import {
  filterPaymentRecoveryQueue,
  getInvoicePaymentSummary,
  getPaymentPortfolioSummary,
  getPaymentRecoveryQueue,
} from "@/lib/invoices/payments";

describe("payments helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates partial settlement with credits and refunds", () => {
    const summary = getInvoicePaymentSummary({
      amount_paid: 100,
      total: 200,
      status: "sent",
      credited_amount: 30,
      refunded_amount: 20,
      voided_at: null,
    });

    expect(summary.netCollectedAmount).toBe(80);
    expect(summary.effectiveSettledAmount).toBe(110);
    expect(summary.outstandingAmount).toBe(90);
    expect(summary.isPartial).toBe(true);
    expect(summary.collectionLabel).toBe("Partially collected");
    expect(summary.collectionTone).toBe("info");
  });

  it("treats voided invoices as settled with zero outstanding", () => {
    const summary = getInvoicePaymentSummary({
      amount_paid: 0,
      total: 750,
      status: "overdue",
      credited_amount: 0,
      refunded_amount: 0,
      voided_at: "2026-04-10T10:00:00.000Z",
    });

    expect(summary.isVoided).toBe(true);
    expect(summary.isSettled).toBe(true);
    expect(summary.outstandingAmount).toBe(0);
    expect(summary.collectionLabel).toBe("Voided");
  });

  it("builds and filters the recovery queue by urgency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T00:00:00.000Z"));

    const queue = getPaymentRecoveryQueue([
      {
        id: "inv-overdue",
        invoice_number: "INV-100",
        amount_paid: 0,
        total: 5000,
        status: "overdue",
        due_date: "2026-04-01",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
        client: { name: "Acme" },
      },
      {
        id: "inv-partial",
        invoice_number: "INV-101",
        amount_paid: 600,
        total: 1000,
        status: "sent",
        due_date: "2026-04-20",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
        client: { name: "Bravo" },
      },
      {
        id: "inv-open",
        invoice_number: "INV-102",
        amount_paid: 0,
        total: 800,
        status: "viewed",
        due_date: "2026-04-18",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
        client: { name: "Charlie" },
      },
    ]);

    expect(queue.map((item) => item.id)).toEqual([
      "inv-overdue",
      "inv-partial",
      "inv-open",
    ]);
    expect(filterPaymentRecoveryQueue(queue, "overdue").map((item) => item.id)).toEqual([
      "inv-overdue",
    ]);
    expect(filterPaymentRecoveryQueue(queue, "partial").map((item) => item.id)).toEqual([
      "inv-partial",
    ]);
    expect(filterPaymentRecoveryQueue(queue, "open").map((item) => item.id)).toEqual([
      "inv-open",
    ]);
  });

  it("summarizes portfolio collection posture", () => {
    const summary = getPaymentPortfolioSummary([
      {
        amount_paid: 200,
        total: 200,
        status: "paid",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
      },
      {
        amount_paid: 50,
        total: 200,
        status: "sent",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
      },
      {
        amount_paid: 0,
        total: 300,
        status: "overdue",
        credited_amount: 0,
        refunded_amount: 0,
        voided_at: null,
      },
    ]);

    expect(summary.fullyCollectedCount).toBe(1);
    expect(summary.partiallyCollectedCount).toBe(1);
    expect(summary.openCount).toBe(1);
    expect(summary.overdueOpenCount).toBe(1);
    expect(summary.outstandingAmount).toBe(450);
  });
});
