import type { Invoice, InvoiceStatus } from "@/types/database";
import { recordActivity } from "@/lib/activity/log";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type TransitionableInvoice = Omit<Invoice, "client"> & {
  client?: Invoice["client"] | null;
};

export interface InvoiceTransition {
  status: InvoiceStatus;
  label: string;
  description: string;
  tone?: "danger";
}

const transitionMap: Record<InvoiceStatus, InvoiceTransition[]> = {
  draft: [
    {
      status: "sent",
      label: "Send invoice",
      description: "Set the invoice live and stamp the sent date.",
    },
    {
      status: "cancelled",
      label: "Cancel invoice",
      description: "Close the draft and remove it from follow-up.",
      tone: "danger",
    },
  ],
  sent: [
    {
      status: "viewed",
      label: "Mark as viewed",
      description: "Record that the recipient has reviewed the invoice.",
    },
    {
      status: "overdue",
      label: "Mark overdue",
      description: "Escalate the invoice for collections attention.",
    },
    {
      status: "paid",
      label: "Mark as paid",
      description: "Record collection and close the outstanding balance.",
    },
    {
      status: "cancelled",
      label: "Cancel invoice",
      description: "Stop further follow-up on this invoice.",
      tone: "danger",
    },
  ],
  viewed: [
    {
      status: "overdue",
      label: "Mark overdue",
      description: "Escalate the invoice for collections attention.",
    },
    {
      status: "paid",
      label: "Mark as paid",
      description: "Record collection and close the outstanding balance.",
    },
    {
      status: "cancelled",
      label: "Cancel invoice",
      description: "Stop further follow-up on this invoice.",
      tone: "danger",
    },
  ],
  overdue: [
    {
      status: "paid",
      label: "Mark as paid",
      description: "Record collection and close the outstanding balance.",
    },
    {
      status: "cancelled",
      label: "Cancel invoice",
      description: "Stop further follow-up on this invoice.",
      tone: "danger",
    },
  ],
  paid: [],
  cancelled: [],
};

const activityActionByStatus: Record<InvoiceStatus, string> = {
  draft: "invoice.created",
  sent: "invoice.sent",
  viewed: "invoice.viewed",
  paid: "invoice.paid",
  overdue: "invoice.overdue",
  cancelled: "invoice.cancelled",
};

export function getInvoiceTransitions(status: InvoiceStatus) {
  return transitionMap[status];
}

export function getInvoiceCollectionsMessage(invoice: TransitionableInvoice) {
  const now = new Date();
  const dueDate = new Date(invoice.due_date);
  const diffDays = Math.ceil(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (invoice.status === "paid" && invoice.paid_at) {
    return `Collected on ${new Date(invoice.paid_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  }

  if (invoice.status === "cancelled") {
    return "This invoice has been closed and removed from active collections.";
  }

  if (invoice.status === "draft") {
    return "Draft invoices are internal only until they are sent to the client.";
  }

  if (diffDays < 0) {
    const daysLate = Math.abs(diffDays);
    return `${daysLate} day${daysLate === 1 ? "" : "s"} past due and needs attention.`;
  }

  if (diffDays === 0) {
    return "Due today. A follow-up may be required if payment does not land.";
  }

  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}.`;
}

export async function transitionInvoiceStatus(
  invoice: TransitionableInvoice,
  nextStatus: InvoiceStatus,
  userId?: string | null
) {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  const updates: Partial<Invoice> & Record<string, unknown> = {
    status: nextStatus,
  };

  if (nextStatus === "sent") {
    updates.sent_at = invoice.sent_at ?? now;
  }

  if (nextStatus === "paid") {
    updates.paid_at = invoice.paid_at ?? now;
    updates.amount_paid = invoice.total;
  }

  if (nextStatus !== "paid") {
    updates.amount_paid = invoice.amount_paid ?? 0;
  }

  const { error } = await supabase.from("invoices").update(updates).eq("id", invoice.id);

  if (error) {
    throw error;
  }

  await recordActivity({
    orgId: invoice.org_id,
    userId,
    entityType: "invoice",
    entityId: invoice.id,
    action: activityActionByStatus[nextStatus],
    metadata: {
      invoice_number: invoice.invoice_number,
      client_name: invoice.client?.name ?? null,
      previous_status: invoice.status,
      next_status: nextStatus,
      total: invoice.total,
    },
  });

  return {
    ...invoice,
    ...updates,
    status: nextStatus,
  } as TransitionableInvoice;
}
