import { recordActivity } from "@/lib/activity/log";
import type { Client, Invoice } from "@/types/database";

type ReminderStage = "gentle" | "due-soon" | "overdue";

type ReminderInvoiceLike = Pick<
  Invoice,
  "id" | "org_id" | "invoice_number" | "status" | "due_date" | "total" | "amount_paid"
> & {
  client?: Pick<Client, "name"> | null;
};

type ReminderActivityLike = {
  action: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const collectionsActions = new Set([
  "invoice.sent",
  "invoice.viewed",
  "invoice.overdue",
  "invoice.paid",
  "invoice.reminder_sent",
]);

function getDaysUntilDue(invoice: Pick<ReminderInvoiceLike, "due_date">) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(invoice.due_date);
  const startOfDueDate = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );

  return Math.round(
    (startOfDueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function canRecordReminder(invoice: Pick<ReminderInvoiceLike, "status">) {
  return invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "overdue";
}

export function getReminderStage(
  invoice: Pick<ReminderInvoiceLike, "status" | "due_date">
): ReminderStage {
  if (invoice.status === "overdue") {
    return "overdue";
  }

  const daysUntilDue = getDaysUntilDue(invoice);
  if (daysUntilDue <= 3) {
    return "due-soon";
  }

  return "gentle";
}

export function getReminderStageLabel(stage: ReminderStage) {
  if (stage === "overdue") return "Overdue reminder";
  if (stage === "due-soon") return "Due soon reminder";
  return "Friendly reminder";
}

export function getReminderRecommendation(
  invoice: Pick<ReminderInvoiceLike, "status" | "due_date">
) {
  if (invoice.status === "draft") {
    return "Send the invoice before starting client follow-up.";
  }

  if (invoice.status === "paid") {
    return "Payment is collected. No follow-up is needed unless reconciliation changes.";
  }

  if (invoice.status === "cancelled") {
    return "This invoice is closed. Any further outreach should happen outside the billing workflow.";
  }

  const daysUntilDue = getDaysUntilDue(invoice);
  if (invoice.status === "overdue" || daysUntilDue < 0) {
    return "Escalate follow-up and capture every reminder touchpoint while the balance remains overdue.";
  }

  if (daysUntilDue <= 3) {
    return "This invoice is close to due. A reminder now helps reduce last-minute collections work.";
  }

  return "Keep momentum with a lightweight reminder if the client has not acknowledged the invoice yet.";
}

export async function recordInvoiceReminder(
  invoice: ReminderInvoiceLike,
  userId?: string | null
) {
  const outstandingBalance = Math.max(
    Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0),
    0
  );
  const reminderStage = getReminderStage(invoice);

  return recordActivity({
    orgId: invoice.org_id,
    userId,
    entityType: "invoice",
    entityId: invoice.id,
    action: "invoice.reminder_sent",
    metadata: {
      invoice_number: invoice.invoice_number,
      client_name: invoice.client?.name ?? null,
      reminder_stage: reminderStage,
      due_date: invoice.due_date,
      outstanding_balance: outstandingBalance,
    },
  });
}

export function getLatestReminderEntry<T extends ReminderActivityLike>(entries: T[]) {
  return entries.find((entry) => entry.action === "invoice.reminder_sent") ?? null;
}

export function getReminderEntryLabel(entry: ReminderActivityLike | null) {
  if (!entry) return "No reminder recorded";

  const reminderStage = entry.metadata?.reminder_stage;
  if (reminderStage === "overdue" || reminderStage === "due-soon" || reminderStage === "gentle") {
    return getReminderStageLabel(reminderStage);
  }

  return "Reminder recorded";
}

export function isCollectionsActivityAction(action: string) {
  return collectionsActions.has(action);
}
