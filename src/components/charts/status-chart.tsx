"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusDistribution } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  draft: "#a3a3a3",
  sent: "#3b82f6",
  viewed: "#8b5cf6",
  paid: "#10b981",
  overdue: "#ef4444",
  cancelled: "#d4d4d4",
};

interface StatusChartProps {
  data: StatusDistribution[];
}

interface StatusTooltipPayload {
  payload: StatusDistribution;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: StatusTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="mb-1 text-xs font-medium capitalize text-neutral-500">{d.status}</p>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
        {d.count} invoice{d.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function StatusChart({ data }: StatusChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              dataKey="count"
              strokeWidth={2}
              stroke="var(--color-background-primary, #fff)"
              animationDuration={800}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#a3a3a3"} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-neutral-900 dark:text-white">{total}</span>
          <span className="text-xs text-neutral-400">total</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[d.status] }}
            />
            <span className="text-sm capitalize text-neutral-600 dark:text-neutral-400">
              {d.status}
            </span>
            <span className="ml-auto text-sm font-medium text-neutral-900 dark:text-white">
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
