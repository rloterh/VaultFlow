"use client";

import {
  CheckCircle2,
  CircleDashed,
  Copy,
  Download,
  Eye,
  Send,
  XCircle,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import type { Invoice, InvoiceStatus } from "@/types/database";

interface InvoiceRowActionsProps {
  invoice: Invoice;
  onUpdated: () => void | Promise<void>;
}

export function InvoiceRowActions({
  invoice,
  onUpdated,
}: InvoiceRowActionsProps) {
  const { can } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const canUpdateInvoices = can("invoices:update");

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    addToast({
      type: "success",
      title: `${label} copied`,
      description: value,
    });
  }

  async function updateStatus(status: InvoiceStatus) {
    const supabase = getSupabaseBrowserClient();
    const updates: Record<string, string | null> = { status };

    if (status === "sent") {
      updates.sent_at = new Date().toISOString();
    }

    if (status === "paid") {
      updates.paid_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", invoice.id);

    if (error) {
      addToast({
        type: "error",
        title: "Invoice update failed",
        description: error.message,
      });
      return;
    }

    addToast({
      type: "success",
      title: `Invoice ${status}`,
      description: `${invoice.invoice_number} was updated successfully.`,
    });
    await onUpdated();
  }

  const statusActions = [];

  if (canUpdateInvoices && invoice.status === "draft") {
    statusActions.push({
      label: "Send invoice",
      description: "Set the invoice live and stamp the sent date.",
      icon: Send,
      onSelect: () => updateStatus("sent"),
    });
  }

  if (
    canUpdateInvoices &&
    ["sent", "viewed", "overdue"].includes(invoice.status)
  ) {
    statusActions.push({
      label: "Mark as paid",
      description: "Close the balance and record a payment timestamp.",
      icon: CheckCircle2,
      onSelect: () => updateStatus("paid"),
    });
  }

  if (canUpdateInvoices && ["draft", "sent", "viewed"].includes(invoice.status)) {
    statusActions.push({
      label: "Mark overdue",
      description: "Flag the invoice for collections attention.",
      icon: CircleDashed,
      onSelect: () => updateStatus("overdue"),
    });
  }

  if (canUpdateInvoices && invoice.status !== "cancelled" && invoice.status !== "paid") {
    statusActions.push({
      label: "Cancel invoice",
      description: "Stop further follow-up on this invoice.",
      icon: XCircle,
      tone: "danger" as const,
      onSelect: () => updateStatus("cancelled"),
    });
  }

  return (
    <ActionMenu
      triggerLabel={`Open actions for ${invoice.invoice_number}`}
      sections={[
        {
          items: [
            {
              label: "Open invoice",
              description: "Review full invoice details and line items.",
              href: `/dashboard/invoices/${invoice.id}`,
              icon: Eye,
            },
            {
              label: "Download PDF",
              description: "Export the invoice document for sharing.",
              href: `/api/invoices/${invoice.id}/pdf`,
              icon: Download,
              external: true,
            },
            {
              label: "Copy invoice number",
              description: "Copy a reference for support or reconciliation.",
              icon: Copy,
              onSelect: () => copyValue(invoice.invoice_number, "Invoice number"),
            },
          ],
        },
        ...(statusActions.length
          ? [{ label: "Status actions", items: statusActions }]
          : []),
      ]}
    />
  );
}
