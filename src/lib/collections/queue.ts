import type { Invoice } from "@/types/database";

export interface ReminderActivityLike {
  entity_id: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface ReminderSummary {
  count: number;
  latestEntry: ReminderActivityLike | null;
}

export interface CollectionsQueueItem {
  invoice: Invoice;
  clientName: string;
  outstandingAmount: number;
  daysUntilDue: number;
  latestReminderAt: string | null;
  reminderCount: number;
  priority: "critical" | "high" | "monitor";
}

export type CollectionsQueuePreset =
  | "all"
  | "needs-touch"
  | "overdue"
  | "unreminded";

export interface CollectionsQueueSummary {
  openInvoices: number;
  needsTouch: number;
  overdue: number;
  unreminded: number;
  totalOutstanding: number;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysUntilDue(dueDate: string) {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysSince(value: string) {
  return Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function buildReminderSummaryMap(reminders: ReminderActivityLike[]) {
  const summaryMap = new Map<string, ReminderSummary>();

  reminders.forEach((entry) => {
    const current = summaryMap.get(entry.entity_id);

    if (!current) {
      summaryMap.set(entry.entity_id, {
        count: 1,
        latestEntry: entry,
      });
      return;
    }

    current.count += 1;
    if (
      !current.latestEntry ||
      new Date(entry.created_at).getTime() >
        new Date(current.latestEntry.created_at).getTime()
    ) {
      current.latestEntry = entry;
    }
  });

  return summaryMap;
}

export function buildCollectionsQueue(
  invoices: Invoice[],
  reminders: ReminderActivityLike[]
) {
  const reminderSummaryMap = buildReminderSummaryMap(reminders);

  return invoices
    .filter((invoice) => ["sent", "viewed", "overdue"].includes(invoice.status))
    .map((invoice) => {
      const reminderSummary = reminderSummaryMap.get(invoice.id) ?? {
        count: 0,
        latestEntry: null,
      };
      const outstandingAmount = Math.max(
        Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0),
        0
      );
      const daysUntilDue = getDaysUntilDue(invoice.due_date);
      const daysSinceReminder = reminderSummary.latestEntry
        ? getDaysSince(reminderSummary.latestEntry.created_at)
        : null;

      let priority: CollectionsQueueItem["priority"] = "monitor";

      if (
        invoice.status === "overdue" &&
        (daysSinceReminder === null || daysSinceReminder >= 3)
      ) {
        priority = "critical";
      } else if (
        daysUntilDue <= 3 &&
        invoice.status !== "paid" &&
        (daysSinceReminder === null || daysSinceReminder >= 2)
      ) {
        priority = "high";
      } else if (reminderSummary.count === 0 && invoice.status !== "sent") {
        priority = "high";
      }

      return {
        invoice,
        clientName: invoice.client?.name ?? "Unknown client",
        outstandingAmount,
        daysUntilDue,
        latestReminderAt: reminderSummary.latestEntry?.created_at ?? null,
        reminderCount: reminderSummary.count,
        priority,
      };
    })
    .sort((left, right) => {
      const weight = { critical: 0, high: 1, monitor: 2 };
      return (
        weight[left.priority] - weight[right.priority] ||
        left.daysUntilDue - right.daysUntilDue ||
        right.outstandingAmount - left.outstandingAmount
      );
    });
}

export function filterCollectionsQueue(
  items: CollectionsQueueItem[],
  preset: CollectionsQueuePreset
) {
  switch (preset) {
    case "needs-touch":
      return items.filter((item) => item.priority !== "monitor");
    case "overdue":
      return items.filter((item) => item.invoice.status === "overdue");
    case "unreminded":
      return items.filter((item) => item.reminderCount === 0);
    case "all":
    default:
      return items;
  }
}

export function summarizeCollectionsQueue(
  items: CollectionsQueueItem[]
): CollectionsQueueSummary {
  return {
    openInvoices: items.length,
    needsTouch: items.filter((item) => item.priority !== "monitor").length,
    overdue: items.filter((item) => item.invoice.status === "overdue").length,
    unreminded: items.filter((item) => item.reminderCount === 0).length,
    totalOutstanding: items.reduce(
      (sum, item) => sum + item.outstandingAmount,
      0
    ),
  };
}

export function formatQueuePriority(priority: CollectionsQueueItem["priority"]) {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "Needs touch";
  return "Monitoring";
}

export function formatLatestReminderStatus(item: CollectionsQueueItem) {
  if (!item.latestReminderAt) return "No reminder recorded";
  if (item.reminderCount === 1) return "1 reminder logged";
  return `${item.reminderCount} reminders logged`;
}
