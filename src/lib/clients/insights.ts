import type { Invoice } from "@/types/database";

export type ClientHealthState = "new" | "healthy" | "attention" | "at-risk";
export type ClientHealthVariant = "info" | "success" | "warning" | "danger";

export interface ClientFinancialSnapshot {
  totalInvoices: number;
  paidTotal: number;
  pendingTotal: number;
  overdueTotal: number;
  openInvoices: number;
  paidRate: number;
  lastInvoiceDate: string | null;
  nextDueDate: string | null;
  health: ClientHealthState;
  healthLabel: string;
  healthVariant: ClientHealthVariant;
  collectionSummary: string;
}

export function buildClientFinancialSnapshot(
  invoices: Invoice[]
): ClientFinancialSnapshot {
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const pending = invoices.filter((invoice) =>
    ["sent", "viewed"].includes(invoice.status)
  );
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");
  const tracked = [...invoices].sort(
    (left, right) =>
      new Date(right.issue_date).getTime() - new Date(left.issue_date).getTime()
  );

  const paidTotal = paid.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const pendingTotal = pending.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0
  );
  const overdueTotal = overdue.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0
  );
  const openInvoices = pending.length + overdue.length;
  const totalInvoices = invoices.length;
  const paidRate =
    totalInvoices > 0 ? Math.round((paid.length / totalInvoices) * 100) : 0;
  const nextDueDate = [...pending, ...overdue]
    .sort(
      (left, right) =>
        new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
    )[0]?.due_date ?? null;

  let health: ClientHealthState = "healthy";
  let healthLabel = "Healthy";
  let healthVariant: ClientHealthVariant = "success";
  let collectionSummary = "Collections posture is stable.";

  if (totalInvoices === 0) {
    health = "new";
    healthLabel = "New";
    healthVariant = "info";
    collectionSummary = "No invoices yet. This account is ready for first billing.";
  } else if (overdueTotal > 0) {
    health = "at-risk";
    healthLabel = "At Risk";
    healthVariant = "danger";
    collectionSummary = "At least one invoice is overdue and needs follow-up.";
  } else if (pendingTotal > 0) {
    health = "attention";
    healthLabel = "Attention";
    healthVariant = "warning";
    collectionSummary = "Open invoices are still waiting on collection.";
  }

  return {
    totalInvoices,
    paidTotal,
    pendingTotal,
    overdueTotal,
    openInvoices,
    paidRate,
    lastInvoiceDate: tracked[0]?.issue_date ?? null,
    nextDueDate,
    health,
    healthLabel,
    healthVariant,
    collectionSummary,
  };
}

export function buildClientInsightMap(invoices: Invoice[]) {
  const invoiceMap = new Map<string, Invoice[]>();

  for (const invoice of invoices) {
    const current = invoiceMap.get(invoice.client_id) ?? [];
    current.push(invoice);
    invoiceMap.set(invoice.client_id, current);
  }

  const insightMap = new Map<string, ClientFinancialSnapshot>();
  for (const [clientId, clientInvoices] of invoiceMap.entries()) {
    insightMap.set(clientId, buildClientFinancialSnapshot(clientInvoices));
  }

  return insightMap;
}
