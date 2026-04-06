"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useUIStore, type Toast } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50",
  error: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50",
};

const iconStyles = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((s) => s.removeToast);
  const Icon = icons[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "flex w-[360px] items-start gap-3 rounded-lg border p-4 shadow-lg",
        styles[toast.type]
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconStyles[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
