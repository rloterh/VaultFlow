import { cn } from "@/lib/utils/cn";
import type { InvoiceStatus } from "@/types/database";

const statusConfig: Record<InvoiceStatus, { label: string; className: string; dot: string }> = {
  draft: {
    label: "Draft",
    className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    dot: "bg-neutral-400",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  viewed: {
    label: "Viewed",
    className: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
    dot: "bg-neutral-300",
  },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
