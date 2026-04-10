import type { Invoice } from "@/types/database";

export interface InvoicePaymentSummary {
  collectedAmount: number;
  outstandingAmount: number;
  isSettled: boolean;
  isPartial: boolean;
  paymentProgress: number;
  collectionLabel: string;
  collectionTone: "default" | "success" | "warning" | "danger" | "info";
}

export interface PaymentPortfolioSummary {
  fullyCollectedCount: number;
  partiallyCollectedCount: number;
  openCount: number;
  overdueOpenCount: number;
  collectedAmount: number;
  outstandingAmount: number;
}

export interface PaymentRecoveryQueueItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: Invoice["status"];
  dueDate: string;
  collectedAmount: number;
  outstandingAmount: number;
  priorityScore: number;
  isPartial: boolean;
}

export function getInvoicePaymentSummary(
  invoice: Pick<Invoice, "amount_paid" | "total" | "status">
): InvoicePaymentSummary {
  const total = Number(invoice.total) || 0;
  const collectedAmount = Math.min(Number(invoice.amount_paid) || 0, total);
  const outstandingAmount = Math.max(total - collectedAmount, 0);
  const paymentProgress = total > 0 ? Math.min((collectedAmount / total) * 100, 100) : 0;
  const isSettled = outstandingAmount === 0 && total > 0;
  const isPartial = collectedAmount > 0 && outstandingAmount > 0;

  if (isSettled || invoice.status === "paid") {
    return {
      collectedAmount,
      outstandingAmount,
      isSettled: true,
      isPartial: false,
      paymentProgress: 100,
      collectionLabel: "Settled in full",
      collectionTone: "success",
    };
  }

  if (isPartial) {
    return {
      collectedAmount,
      outstandingAmount,
      isSettled: false,
      isPartial: true,
      paymentProgress,
      collectionLabel: "Partially collected",
      collectionTone: invoice.status === "overdue" ? "warning" : "info",
    };
  }

  if (invoice.status === "overdue") {
    return {
      collectedAmount,
      outstandingAmount,
      isSettled: false,
      isPartial: false,
      paymentProgress,
      collectionLabel: "Overdue and unpaid",
      collectionTone: "danger",
    };
  }

  return {
    collectedAmount,
    outstandingAmount,
    isSettled: false,
    isPartial: false,
    paymentProgress,
    collectionLabel: "Awaiting collection",
    collectionTone: "default",
  };
}

export function getPaymentPortfolioSummary(
  invoices: Pick<Invoice, "amount_paid" | "total" | "status">[]
): PaymentPortfolioSummary {
  return invoices.reduce<PaymentPortfolioSummary>(
    (summary, invoice) => {
      const payment = getInvoicePaymentSummary(invoice);

      summary.collectedAmount += payment.collectedAmount;
      summary.outstandingAmount += payment.outstandingAmount;

      if (payment.isSettled) {
        summary.fullyCollectedCount += 1;
      } else if (payment.isPartial) {
        summary.partiallyCollectedCount += 1;
      } else {
        summary.openCount += 1;
      }

      if (invoice.status === "overdue" && payment.outstandingAmount > 0) {
        summary.overdueOpenCount += 1;
      }

      return summary;
    },
    {
      fullyCollectedCount: 0,
      partiallyCollectedCount: 0,
      openCount: 0,
      overdueOpenCount: 0,
      collectedAmount: 0,
      outstandingAmount: 0,
    }
  );
}

export function getPaymentRecoveryQueue(
  invoices: Array<
    Pick<Invoice, "id" | "invoice_number" | "amount_paid" | "total" | "status" | "due_date"> & {
      client?: { name?: string | null };
    }
  >,
  limit = 5
): PaymentRecoveryQueueItem[] {
  const now = Date.now();

  return invoices
    .map((invoice) => {
      const payment = getInvoicePaymentSummary(invoice);
      const dueMs = new Date(invoice.due_date).getTime();
      const dayDelta = Math.round((now - dueMs) / (1000 * 60 * 60 * 24));
      const overdueWeight = dayDelta > 0 ? dayDelta * 10 : 0;
      const partialWeight = payment.isPartial ? 25 : 0;
      const openWeight = payment.outstandingAmount > 0 ? payment.outstandingAmount / 100 : 0;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client?.name ?? "Unknown client",
        status: invoice.status,
        dueDate: invoice.due_date,
        collectedAmount: payment.collectedAmount,
        outstandingAmount: payment.outstandingAmount,
        priorityScore: overdueWeight + partialWeight + openWeight,
        isPartial: payment.isPartial,
      };
    })
    .filter((invoice) => invoice.outstandingAmount > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}
