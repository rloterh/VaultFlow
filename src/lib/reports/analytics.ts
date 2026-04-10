import type {
  Client,
  Invoice,
  InvoiceStatus,
  RevenueDataPoint,
  StatusDistribution,
  TopClient,
} from "@/types/database";

export type ReportRange = "30d" | "90d" | "365d" | "all";

export interface ReportFilters {
  range: ReportRange;
  status: InvoiceStatus | "all";
}

export interface ReportSummary {
  collectedRevenue: number;
  outstandingBalance: number;
  totalInvoices: number;
  collectionRate: number;
  overdueAmount: number;
  overdueCount: number;
  averageInvoiceValue: number;
}

export interface ReportInsight {
  id: string;
  title: string;
  value: string;
  description: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export interface ReportAttentionItem {
  invoice: Invoice;
  outstandingAmount: number;
  priority: "overdue" | "due-soon" | "open";
  daysUntilDue: number;
}

export interface ReportSnapshot {
  filters: ReportFilters;
  invoices: Invoice[];
  summary: ReportSummary;
  revenueData: RevenueDataPoint[];
  statusData: StatusDistribution[];
  topClients: TopClient[];
  insights: ReportInsight[];
  attentionQueue: ReportAttentionItem[];
}

const priorityWeight: Record<ReportAttentionItem["priority"], number> = {
  overdue: 0,
  "due-soon": 1,
  open: 2,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function formatInvoiceStatus(status: InvoiceStatus) {
  return statusLabels[status];
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRangeStart(range: ReportRange, referenceDate: Date) {
  const base = startOfDay(referenceDate);

  switch (range) {
    case "30d":
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() - 29);
    case "90d":
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() - 89);
    case "365d":
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() - 364);
    case "all":
    default:
      return null;
  }
}

function getMonthWindow(range: ReportRange) {
  switch (range) {
    case "30d":
      return 3;
    case "90d":
      return 4;
    case "365d":
    case "all":
    default:
      return 12;
  }
}

function getInvoiceTotal(invoice: Invoice) {
  return Number(invoice.total ?? 0);
}

function getOutstandingBalance(invoice: Invoice) {
  return Math.max(getInvoiceTotal(invoice) - Number(invoice.amount_paid ?? 0), 0);
}

function buildClientLookup(clients: Client[], invoices: Invoice[]) {
  const lookup = new Map<string, { name: string; company: string | null }>();

  clients.forEach((client) => {
    lookup.set(client.id, {
      name: client.name,
      company: client.company,
    });
  });

  invoices.forEach((invoice) => {
    if (invoice.client) {
      lookup.set(invoice.client_id, {
        name: invoice.client.name,
        company: invoice.client.company,
      });
    }
  });

  return lookup;
}

export function buildReportSnapshot(
  sourceInvoices: Invoice[],
  clients: Client[],
  filters: ReportFilters,
  referenceDate = new Date()
): ReportSnapshot {
  const rangeStart = getRangeStart(filters.range, referenceDate);
  const clientLookup = buildClientLookup(clients, sourceInvoices);
  const filteredInvoices = sourceInvoices.filter((invoice) => {
    const issueDate = startOfDay(new Date(invoice.issue_date));
    const matchesRange = rangeStart ? issueDate >= rangeStart : true;
    const matchesStatus = filters.status === "all" ? true : invoice.status === filters.status;
    return matchesRange && matchesStatus;
  });

  const paidInvoices = filteredInvoices.filter((invoice) => invoice.status === "paid");
  const nonCancelledInvoices = filteredInvoices.filter((invoice) => invoice.status !== "cancelled");
  const actionedInvoices = filteredInvoices.filter(
    (invoice) => invoice.status !== "draft" && invoice.status !== "cancelled"
  );
  const outstandingInvoices = nonCancelledInvoices.filter((invoice) => invoice.status !== "paid");
  const overdueInvoices = filteredInvoices.filter((invoice) => invoice.status === "overdue");

  const collectedRevenue = paidInvoices.reduce(
    (sum, invoice) => sum + getInvoiceTotal(invoice),
    0
  );
  const outstandingBalance = outstandingInvoices.reduce(
    (sum, invoice) => sum + getOutstandingBalance(invoice),
    0
  );
  const overdueAmount = overdueInvoices.reduce(
    (sum, invoice) => sum + getOutstandingBalance(invoice),
    0
  );
  const averageInvoiceValue =
    nonCancelledInvoices.length > 0
      ? nonCancelledInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0) /
        nonCancelledInvoices.length
      : 0;
  const collectionRate =
    actionedInvoices.length > 0
      ? Math.round((paidInvoices.length / actionedInvoices.length) * 100)
      : 0;

  const revenueData: RevenueDataPoint[] = [];
  const monthWindow = getMonthWindow(filters.range);
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

  for (let index = monthWindow - 1; index >= 0; index -= 1) {
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - index, 1);
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const monthInvoices = paidInvoices.filter((invoice) => {
      const issueDate = new Date(invoice.issue_date);
      return issueDate >= monthStart && issueDate <= monthEnd;
    });

    revenueData.push({
      month: monthFormatter.format(monthStart),
      revenue: monthInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0),
      invoices: monthInvoices.length,
    });
  }

  const statusMap = new Map<InvoiceStatus, { count: number; amount: number }>();
  filteredInvoices.forEach((invoice) => {
    const current = statusMap.get(invoice.status) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += getInvoiceTotal(invoice);
    statusMap.set(invoice.status, current);
  });

  const statusData: StatusDistribution[] = Array.from(statusMap.entries()).map(
    ([status, totals]) => ({
      status,
      count: totals.count,
      amount: totals.amount,
    })
  );

  const billedByClient = new Map<
    string,
    { totalRevenue: number; invoiceCount: number; name: string; company: string | null }
  >();
  const openExposureByClient = new Map<string, number>();

  filteredInvoices.forEach((invoice) => {
    const clientInfo = clientLookup.get(invoice.client_id) ?? {
      name: "Unknown client",
      company: null,
    };
    const billed = billedByClient.get(invoice.client_id) ?? {
      totalRevenue: 0,
      invoiceCount: 0,
      name: clientInfo.name,
      company: clientInfo.company,
    };

    billed.totalRevenue += getInvoiceTotal(invoice);
    billed.invoiceCount += 1;
    billedByClient.set(invoice.client_id, billed);

    if (invoice.status !== "paid" && invoice.status !== "cancelled") {
      openExposureByClient.set(
        invoice.client_id,
        (openExposureByClient.get(invoice.client_id) ?? 0) + getOutstandingBalance(invoice)
      );
    }
  });

  const topClients: TopClient[] = Array.from(billedByClient.entries())
    .map(([clientId, entry]) => ({
      id: clientId,
      name: entry.name,
      company: entry.company,
      total_revenue: entry.totalRevenue,
      invoice_count: entry.invoiceCount,
    }))
    .sort((left, right) => right.total_revenue - left.total_revenue)
    .slice(0, 5);

  const dominantStatus = statusData
    .slice()
    .sort((left, right) => right.count - left.count)[0];

  const largestOpenExposure = Array.from(openExposureByClient.entries())
    .map(([clientId, amount]) => ({
      id: clientId,
      amount,
      ...(clientLookup.get(clientId) ?? { name: "Unknown client", company: null }),
    }))
    .sort((left, right) => right.amount - left.amount)[0];

  const insights: ReportInsight[] = [
    {
      id: "collections-pressure",
      title: "Collections pressure",
      value: formatCurrency(overdueAmount),
      description:
        overdueInvoices.length > 0
          ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"} need attention in this view.`
          : "No overdue invoices are showing up in the current filter set.",
      tone: overdueAmount > 0 ? "danger" : "success",
    },
    {
      id: "largest-open-account",
      title: "Largest open account",
      value: largestOpenExposure ? largestOpenExposure.name : "No open balance",
      description: largestOpenExposure
        ? `${formatCurrency(largestOpenExposure.amount)} remains outstanding for this account.`
        : "All visible accounts are settled or cancelled.",
      tone: largestOpenExposure ? "warning" : "success",
    },
    {
      id: "workflow-mix",
      title: "Workflow mix",
      value: dominantStatus ? formatInvoiceStatus(dominantStatus.status) : "No active flow",
      description: dominantStatus
        ? `${dominantStatus.count} invoice${dominantStatus.count === 1 ? "" : "s"} are currently ${formatInvoiceStatus(dominantStatus.status).toLowerCase()}.`
        : "Generate or send invoices to populate operational reporting.",
      tone:
        dominantStatus?.status === "paid"
          ? "success"
          : dominantStatus?.status === "overdue"
            ? "danger"
            : "neutral",
    },
  ];

  const attentionQueue: ReportAttentionItem[] = outstandingInvoices
    .map((invoice) => {
      const dueDate = startOfDay(new Date(invoice.due_date));
      const daysUntilDue = Math.round(
        (dueDate.getTime() - startOfDay(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const priority: ReportAttentionItem["priority"] =
        invoice.status === "overdue" || daysUntilDue < 0
          ? "overdue"
          : daysUntilDue <= 7
            ? "due-soon"
            : "open";

      return {
        invoice,
        outstandingAmount: getOutstandingBalance(invoice),
        priority,
        daysUntilDue,
      };
    })
    .sort((left, right) => {
      return (
        priorityWeight[left.priority] - priorityWeight[right.priority] ||
        left.daysUntilDue - right.daysUntilDue ||
        right.outstandingAmount - left.outstandingAmount
      );
    })
    .slice(0, 5);

  return {
    filters,
    invoices: filteredInvoices,
    summary: {
      collectedRevenue,
      outstandingBalance,
      totalInvoices: filteredInvoices.length,
      collectionRate,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      averageInvoiceValue,
    },
    revenueData,
    statusData,
    topClients,
    insights,
    attentionQueue,
  };
}
