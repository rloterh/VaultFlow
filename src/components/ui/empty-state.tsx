import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
        <Icon className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-medium text-neutral-900 dark:text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
