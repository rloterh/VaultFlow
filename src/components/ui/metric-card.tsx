"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  icon: LucideIcon;
  iconColor?: string;
  index?: number;
}

export function MetricCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  iconColor = "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  index = 0,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      className="rounded-xl border border-neutral-200/60 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        <div className={cn("rounded-lg p-2", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-neutral-900 dark:text-white">{value}</p>
        {change && (
          <div className="mt-1 flex items-center gap-1 text-sm">
            {trend === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            )}
            <span
              className={cn(
                trend === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {change}
            </span>
            <span className="text-neutral-400">vs last month</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
