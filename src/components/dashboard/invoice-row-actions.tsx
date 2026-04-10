"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Send,
  XCircle,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getInvoiceTransitions,
  transitionInvoiceStatus,
} from "@/lib/invoices/lifecycle";
import { useUIStore } from "@/stores/ui-store";
import type { Invoice, InvoiceStatus } from "@/types/database";

interface InvoiceRowActionsProps {
  invoice: Invoice;
  onUpdated: () => void | Promise<void>;
}

const statusIconMap: Record<InvoiceStatus, typeof Send> = {
  draft: Eye,
  sent: Send,
  viewed: Eye,
  paid: CheckCircle2,
  overdue: AlertTriangle,
  cancelled: XCircle,
};

export function InvoiceRowActions({
  invoice,
  onUpdated,
}: InvoiceRowActionsProps) {
  const { user } = useAuth();
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
    try {
      await transitionInvoiceStatus(invoice, status, user?.id);
    } catch (error) {
      addToast({
        type: "error",
        title: "Invoice update failed",
        description:
          error instanceof Error
            ? error.message
            : "The invoice could not be updated.",
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

  const statusActions = canUpdateInvoices
    ? getInvoiceTransitions(invoice.status).map((action) => ({
        label: action.label,
        description: action.description,
        icon: statusIconMap[action.status],
        tone: action.tone,
        onSelect: () => updateStatus(action.status),
      }))
    : [];

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
