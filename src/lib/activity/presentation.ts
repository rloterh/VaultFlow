import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CreditCard,
  Edit,
  Eye,
  FileText,
  Send,
  Settings,
  Trash2,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type ActivityLike = {
  action: string;
  entity_type: string;
  metadata?: Record<string, unknown> | null;
};

type ActivityTone = "success" | "warning" | "danger" | "info" | undefined;

const activityConfig: Record<
  string,
  { label: string; icon: LucideIcon; tone?: ActivityTone }
> = {
  "invoice.created": { label: "Created invoice", icon: FileText },
  "invoice.sent": { label: "Sent invoice", icon: Send, tone: "info" },
  "invoice.viewed": { label: "Viewed invoice", icon: Eye, tone: "info" },
  "invoice.paid": { label: "Collected payment", icon: CheckCircle2, tone: "success" },
  "invoice.overdue": { label: "Marked overdue", icon: AlertTriangle, tone: "warning" },
  "invoice.reminder_sent": { label: "Logged reminder", icon: BellRing, tone: "info" },
  "invoice.cancelled": { label: "Cancelled invoice", icon: XCircle, tone: "danger" },
  "invoice.deleted": { label: "Deleted invoice", icon: Trash2, tone: "danger" },
  "invoice.payment_recorded": { label: "Recorded payment", icon: CreditCard, tone: "success" },
  "invoice.recovery_reviewed": { label: "Reviewed recovery", icon: AlertTriangle, tone: "warning" },
  "invoice.credited": { label: "Applied credit", icon: CreditCard, tone: "info" },
  "invoice.voided": { label: "Voided invoice", icon: XCircle, tone: "danger" },
  "invoice.stripe_linked": { label: "Linked Stripe identifiers", icon: CreditCard, tone: "info" },
  "client.created": { label: "Added client", icon: Users },
  "client.updated": { label: "Updated client", icon: Edit },
  "client.archived": { label: "Archived client", icon: Trash2, tone: "danger" },
  "member.invited": { label: "Invited member", icon: UserPlus, tone: "info" },
  "member.removed": { label: "Removed member", icon: Trash2, tone: "danger" },
  "member.role_changed": { label: "Changed role", icon: Users },
  "org.updated": { label: "Updated settings", icon: Settings },
  plan_upgraded: { label: "Upgraded plan", icon: CreditCard, tone: "success" },
  subscription_updated: { label: "Updated subscription", icon: CreditCard, tone: "info" },
  subscription_cancelled: { label: "Cancelled subscription", icon: XCircle, tone: "danger" },
  payment_received: { label: "Received payment", icon: CreditCard, tone: "success" },
  payment_failed: { label: "Payment failed", icon: AlertTriangle, tone: "danger" },
  payment_refund_requested: { label: "Initiated refund", icon: CreditCard, tone: "info" },
  payment_recorded: { label: "Recorded payment", icon: CreditCard, tone: "success" },
  payment_refunded: { label: "Refunded payment", icon: CreditCard, tone: "warning" },
};

function titleCase(value: string) {
  return value
    .split(/[\._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getActivityLabel(action: string) {
  return activityConfig[action]?.label ?? titleCase(action);
}

export function getActivityIcon(action: string) {
  return activityConfig[action]?.icon ?? Activity;
}

export function getActivityTone(action: string) {
  return activityConfig[action]?.tone;
}

export function getActivitySubject(entry: ActivityLike) {
  const metadata = entry.metadata ?? {};
  const candidate =
    metadata.invoice_number ??
    metadata.client_name ??
    metadata.name ??
    metadata.email ??
    metadata.plan ??
    metadata.previous_plan ??
    metadata.number;

  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : titleCase(entry.entity_type);
}

export function getActivityHeadline(entry: ActivityLike) {
  const label = getActivityLabel(entry.action);
  const subject = getActivitySubject(entry);
  return subject ? `${label} ${subject}` : label;
}
