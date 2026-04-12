import { buildInvoiceIntentHref } from "@/lib/invoices/history";
import type { OrgMembership, Organization } from "@/types/auth";
import type { Invoice, VendorClientAssignment } from "@/types/database";

type GovernanceTone = "success" | "warning" | "danger" | "info";

type InviteLike = {
  id: string;
  email: string;
  expires_at: string;
};

type WorkflowAccountabilityLike = {
  ownerName: string | null;
  lastTouchedAt: string | null;
};

type InvoiceLike = Pick<
  Invoice,
  | "id"
  | "invoice_number"
  | "status"
  | "total"
  | "amount_paid"
  | "due_date"
  | "last_payment_failed_at"
  | "last_recovery_reviewed_at"
  | "voided_at"
> & {
  client?: {
    name?: string | null;
  } | null;
};

export interface GovernancePostureCard {
  label: string;
  value: string;
  tone: GovernanceTone;
  detail: string;
}

export interface GovernanceQueueItem {
  id: string;
  title: string;
  detail: string;
  tone: GovernanceTone;
  href: string;
  actionLabel: string;
}

export interface GovernanceWorkspaceSummary {
  banner: {
    tone: GovernanceTone;
    title: string;
    detail: string;
  };
  postureCards: GovernancePostureCard[];
  moderationQueue: GovernanceQueueItem[];
  counts: {
    privilegedSeats: number;
    restrictedSeats: number;
    financeManagers: number;
    pendingInvites: number;
    expiredInvites: number;
    expiringInvites: number;
    vendorsWithoutAssignments: number;
    invoicesNeedingRecoveryReview: number;
    overdueUnowned: number;
  };
}

const governanceActions = new Set([
  "member.invited",
  "member.removed",
  "member.role_changed",
  "org.updated",
]);

const billingControlActions = new Set([
  "plan_upgraded",
  "subscription_updated",
  "subscription_cancelled",
  "payment_received",
  "payment_failed",
  "payment_refund_requested",
  "payment_refunded",
  "payment_recorded",
  "invoice.credit_requested",
  "invoice.credited",
  "invoice.void_requested",
  "invoice.voided",
  "invoice.stripe_linked",
]);

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getOpenBalance(invoice: Pick<InvoiceLike, "total" | "amount_paid">) {
  return Math.max(Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0), 0);
}

function needsRecoveryReview(invoice: InvoiceLike) {
  if (!invoice.last_payment_failed_at || invoice.voided_at) {
    return false;
  }

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return false;
  }

  if (getOpenBalance(invoice) <= 0) {
    return false;
  }

  if (!invoice.last_recovery_reviewed_at) {
    return true;
  }

  return (
    new Date(invoice.last_recovery_reviewed_at).getTime() <
    new Date(invoice.last_payment_failed_at).getTime()
  );
}

function getTopRiskInvoice(
  invoices: InvoiceLike[],
  predicate: (invoice: InvoiceLike) => boolean
) {
  return [...invoices]
    .filter(predicate)
    .sort((left, right) => {
      const leftDue = new Date(left.due_date).getTime();
      const rightDue = new Date(right.due_date).getTime();
      return leftDue - rightDue;
    })[0];
}

export function isGovernanceActivityAction(action: string, entityType: string) {
  return entityType === "member" || entityType === "organization" || governanceActions.has(action);
}

export function isBillingControlActivityAction(action: string, entityType: string) {
  return entityType === "billing" || billingControlActions.has(action);
}

export function buildGovernanceWorkspaceSummary({
  organization,
  members,
  invites,
  invoices,
  vendorAssignments,
  workflowAccountability,
}: {
  organization: Pick<Organization, "plan" | "stripe_subscription_id"> | null;
  members: OrgMembership[];
  invites: InviteLike[];
  invoices: InvoiceLike[];
  vendorAssignments: VendorClientAssignment[];
  workflowAccountability: Map<string, WorkflowAccountabilityLike>;
}): GovernanceWorkspaceSummary {
  const privilegedSeats = members.filter((member) =>
    ["owner", "admin"].includes(member.role)
  ).length;
  const restrictedSeats = members.filter((member) =>
    ["vendor", "viewer"].includes(member.role)
  ).length;
  const financeManagers = members.filter(
    (member) => member.role === "finance_manager"
  ).length;
  const pendingInvites = invites.length;
  const expiredInvites = invites.filter((invite) => daysUntil(invite.expires_at) < 0).length;
  const expiringInvites = invites.filter((invite) => {
    const remainingDays = daysUntil(invite.expires_at);
    return remainingDays >= 0 && remainingDays <= 3;
  }).length;

  const vendorMembershipIds = new Set(
    members.filter((member) => member.role === "vendor").map((member) => member.id)
  );
  const assignedVendorMembershipIds = new Set(
    vendorAssignments.map((assignment) => assignment.membership_id)
  );
  const vendorsWithoutAssignments = [...vendorMembershipIds].filter(
    (membershipId) => !assignedVendorMembershipIds.has(membershipId)
  ).length;

  const invoicesNeedingRecoveryReview = invoices.filter(needsRecoveryReview);
  const overdueUnownedInvoices = invoices.filter((invoice) => {
    if (invoice.status !== "overdue" || getOpenBalance(invoice) <= 0) {
      return false;
    }

    return !workflowAccountability.get(invoice.id)?.ownerName;
  });

  const postureCards: GovernancePostureCard[] = [
    {
      label: "Access governance",
      value: `${privilegedSeats} privileged seat${privilegedSeats === 1 ? "" : "s"}`,
      tone:
        members.length > 0 && privilegedSeats / members.length > 0.35
          ? "warning"
          : "success",
      detail:
        members.length > 0 && privilegedSeats / members.length > 0.35
          ? "Privileged access is spreading wider than normal. Re-check least-privilege assignments."
          : "Privileged workspace authority is concentrated to a controlled subset of the team.",
    },
    {
      label: "Invite hygiene",
      value: `${pendingInvites} pending`,
      tone:
        expiredInvites > 0 ? "danger" : expiringInvites > 0 ? "warning" : "success",
      detail:
        expiredInvites > 0
          ? `${expiredInvites} pending invite${expiredInvites === 1 ? "" : "s"} already expired and should be revoked or replaced.`
          : expiringInvites > 0
            ? `${expiringInvites} invite${expiringInvites === 1 ? "" : "s"} expire within 72 hours.`
            : "No stale invite pressure is building inside the workspace.",
    },
    {
      label: "Billing recovery",
      value: `${invoicesNeedingRecoveryReview.length} at risk`,
      tone: invoicesNeedingRecoveryReview.length > 0 ? "danger" : "success",
      detail:
        invoicesNeedingRecoveryReview.length > 0
          ? "Payment failures exist without a newer recovery review on record."
          : "Stripe-linked failures and recovery reviews are currently aligned.",
    },
    {
      label: "Vendor scoping",
      value: `${vendorsWithoutAssignments} unassigned`,
      tone: vendorsWithoutAssignments > 0 ? "warning" : "success",
      detail:
        vendorsWithoutAssignments > 0
          ? "One or more vendor seats exist without explicit client scope."
          : "Every vendor seat currently has assignment-backed visibility.",
    },
  ];

  const moderationQueue: GovernanceQueueItem[] = [];
  const recoveryInvoice = getTopRiskInvoice(invoices, needsRecoveryReview);
  const overdueUnownedInvoice = getTopRiskInvoice(
    invoices,
    (invoice) =>
      invoice.status === "overdue" &&
      getOpenBalance(invoice) > 0 &&
      !workflowAccountability.get(invoice.id)?.ownerName
  );

  if (recoveryInvoice) {
    moderationQueue.push({
      id: `recovery-${recoveryInvoice.id}`,
      title: "Recovery review missing after payment failure",
      detail: `${recoveryInvoice.invoice_number} still carries open balance after a Stripe failure and has not been reviewed since the failure landed.`,
      tone: "danger",
      href: buildInvoiceIntentHref(recoveryInvoice.id, "recovery"),
      actionLabel: "Open recovery",
    });
  }

  if (expiredInvites > 0) {
    moderationQueue.push({
      id: "expired-invites",
      title: "Pending invites have expired",
      detail: `${expiredInvites} invite${expiredInvites === 1 ? "" : "s"} are already past expiry and should be cleaned up to reduce access ambiguity.`,
      tone: "danger",
      href: "/settings/team",
      actionLabel: "Review invites",
    });
  } else if (expiringInvites > 0) {
    moderationQueue.push({
      id: "expiring-invites",
      title: "Invite expiry window is approaching",
      detail: `${expiringInvites} invite${expiringInvites === 1 ? "" : "s"} will expire within the next 72 hours.`,
      tone: "warning",
      href: "/settings/team",
      actionLabel: "Triage team access",
    });
  }

  if (overdueUnownedInvoice) {
    moderationQueue.push({
      id: `unowned-${overdueUnownedInvoice.id}`,
      title: "Overdue invoice has no clear owner",
      detail: `${overdueUnownedInvoice.invoice_number} is overdue without a recorded workflow owner, which weakens collections accountability.`,
      tone: "warning",
      href: buildInvoiceIntentHref(overdueUnownedInvoice.id, "history"),
      actionLabel: "Open invoice",
    });
  }

  if (vendorsWithoutAssignments > 0) {
    moderationQueue.push({
      id: "vendor-scope",
      title: "Vendor seats need assignment-backed scoping",
      detail: `${vendorsWithoutAssignments} vendor seat${vendorsWithoutAssignments === 1 ? "" : "s"} exist without an active client assignment.`,
      tone: "warning",
      href: "/settings/team",
      actionLabel: "Assign vendor scope",
    });
  }

  if (
    organization?.stripe_subscription_id &&
    organization.plan !== "free" &&
    financeManagers === 0
  ) {
    moderationQueue.push({
      id: "finance-cover",
      title: "Paid workspace has no finance manager seat",
      detail: "Billing is active, but there is no dedicated finance-manager role assigned for recovery and reporting continuity.",
      tone: "info",
      href: "/settings/team",
      actionLabel: "Review roles",
    });
  }

  const banner =
    moderationQueue[0] ??
    ({
      tone: "success",
      title: "Governance posture is stable",
      detail:
        "Access controls, invite hygiene, and billing recovery signals are currently within a healthy operating range.",
    } satisfies GovernanceWorkspaceSummary["banner"]);

  return {
    banner: {
      tone: banner.tone,
      title: moderationQueue[0] ? moderationQueue[0].title : banner.title,
      detail: moderationQueue[0] ? moderationQueue[0].detail : banner.detail,
    },
    postureCards,
    moderationQueue,
    counts: {
      privilegedSeats,
      restrictedSeats,
      financeManagers,
      pendingInvites,
      expiredInvites,
      expiringInvites,
      vendorsWithoutAssignments,
      invoicesNeedingRecoveryReview: invoicesNeedingRecoveryReview.length,
      overdueUnowned: overdueUnownedInvoices.length,
    },
  };
}
