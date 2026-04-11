import { hasMinRole, hasPermission, type Role } from "@/config/roles";
import {
  isBillingControlActivityAction,
  isGovernanceActivityAction,
} from "@/lib/admin/governance";
import { buildInvoiceIntentHref } from "@/lib/invoices/history";
import { buildClientOpsViewHref } from "@/lib/operations/client-views";

type ActivityNavigationEntry = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

const attentionActions = new Set([
  "invoice.overdue",
  "invoice.recovery_reviewed",
  "payment_failed",
  "subscription_cancelled",
  "payment_refund_requested",
  "payment_refunded",
  "invoice.void_requested",
  "invoice.voided",
  "member.removed",
  "member.role_changed",
]);

const recoveryActions = new Set([
  "invoice.overdue",
  "invoice.recovery_reviewed",
  "payment_failed",
  "payment_refund_requested",
  "payment_refunded",
  "invoice.credit_requested",
  "invoice.credited",
  "invoice.void_requested",
  "invoice.voided",
]);

const historyActions = new Set([
  "invoice.payment_recorded",
  "payment_recorded",
  "payment_received",
  "invoice.stripe_linked",
]);

function readMetadataId(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function canOpenAdmin(role: Role | null) {
  return role ? hasMinRole(role, "admin") : false;
}

function canOpenBilling(role: Role | null) {
  return role ? hasPermission(role, "org:billing") : false;
}

function canOpenSettings(role: Role | null) {
  return role ? hasPermission(role, "settings:read") : false;
}

function canOpenActivity(role: Role | null) {
  return role ? hasMinRole(role, "manager") : false;
}

export function isAttentionActivity(entry: ActivityNavigationEntry) {
  return (
    attentionActions.has(entry.action) ||
    (entry.entity_type === "invoice" && recoveryActions.has(entry.action))
  );
}

export function getActivityDestination(
  entry: ActivityNavigationEntry,
  role: Role | null
) {
  const invoiceId =
    entry.entity_type === "invoice"
      ? entry.entity_id ?? null
      : readMetadataId(entry.metadata, "invoice_id");
  const clientId =
    entry.entity_type === "client"
      ? entry.entity_id ?? null
      : readMetadataId(entry.metadata, "client_id");

  if (invoiceId) {
    if (recoveryActions.has(entry.action)) {
      return buildInvoiceIntentHref(invoiceId, "recovery");
    }

    if (historyActions.has(entry.action)) {
      return buildInvoiceIntentHref(invoiceId, "history");
    }

    return `/dashboard/invoices/${invoiceId}`;
  }

  if (clientId) {
    return `/dashboard/clients/${clientId}`;
  }

  if (entry.action === "payment_failed" || entry.action === "invoice.overdue") {
    return buildClientOpsViewHref("at-risk-accounts");
  }

  if (
    entry.action === "invoice.reminder_sent" ||
    entry.action === "invoice.recovery_reviewed"
  ) {
    return buildClientOpsViewHref("collections-focus");
  }

  if (isGovernanceActivityAction(entry.action, entry.entity_type)) {
    if (canOpenAdmin(role)) {
      return "/dashboard/admin";
    }

    if (canOpenSettings(role)) {
      return "/settings";
    }

    return "/dashboard";
  }

  if (isBillingControlActivityAction(entry.action, entry.entity_type)) {
    if (canOpenBilling(role)) {
      return "/settings/billing";
    }

    return "/dashboard/invoices";
  }

  if (canOpenActivity(role)) {
    return "/dashboard/activity";
  }

  return "/dashboard";
}
