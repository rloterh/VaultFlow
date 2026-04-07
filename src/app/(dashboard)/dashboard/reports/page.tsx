"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { BarChart3, TrendingUp, DollarSign, Users } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { RevenueChart, StatusChart } from "@/components/charts";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Skeleton } from "@/components/ui/badge";
import { useOrgStore } from "@/stores/org-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RevenueDataPoint, StatusDistribution, TopClient } from "@/types/database";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="mb-1 text-xs font-medium text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{fmt(payload[0].value)}</p>
    </div>
  );
}

function ReportsContent() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [summary, setSummary] = useState({ totalRev: 0, avgInvoice: 0, totalInvoices: 0, paidRate: 0 });

  const fetchReports = useCallback(async () => {
    if (!currentOrg) return;
    const sb = getSupabaseBrowserClient();

    const [invRes, cliRes] = await Promise.all([
      sb.from("invoices").select("*").eq("org_id", currentOrg.id),
      sb.from("clients").select("id, name, company, total_revenue, invoice_count").eq("org_id", currentOrg.id).eq("is_active", true).order("total_revenue", { ascending: false }).limit(5),
    ]);

    const invoices = invRes.data ?? [];
    const paid = invoices.filter((i: any) => i.status === "paid");
    const totalRev = paid.reduce((s: number, i: any) => s + Number(i.total), 0);

    setSummary({
      totalRev,
      avgInvoice: invoices.length > 0 ? totalRev / Math.max(paid.length, 1) : 0,
      totalInvoices: invoices.length,
      paidRate: invoices.length > 0 ? Math.round((paid.length / invoices.length) * 100) : 0,
    });

    // Revenue by month
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const chart: RevenueDataPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mi = paid.filter((inv: any) => { const id = new Date(inv.issue_date); return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear(); });
      chart.push({ month: months[d.getMonth()], revenue: mi.reduce((s: number, inv: any) => s + Number(inv.total), 0), invoices: mi.length });
    }
    setRevenueData(chart);

    // Status distribution
    const smap = new Map<string, { count: number; amount: number }>();
    invoices.forEach((inv: any) => { const e = smap.get(inv.status) ?? { count: 0, amount: 0 }; e.count++; e.amount += Number(inv.total); smap.set(inv.status, e); });
    setStatusData(Array.from(smap.entries()).map(([status, d]) => ({ status: status as any, count: d.count, amount: d.amount })));

    setTopClients((cliRes.data ?? []) as TopClient[]);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">Financial overview and analytics.</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Revenue" value={fmt(summary.totalRev)} icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" index={0} />
        <MetricCard label="Avg. Invoice" value={fmt(summary.avgInvoice)} icon={TrendingUp} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" index={1} />
        <MetricCard label="Total Invoices" value={String(summary.totalInvoices)} icon={BarChart3} iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" index={2} />
        <MetricCard label="Collection Rate" value={`${summary.paidRate}%`} icon={Users} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" index={3} />
      </div>

      {/* Revenue trend (12 months) */}
      <Card>
        <CardTitle>Revenue trend (12 months)</CardTitle>
        <div className="mt-4">
          <RevenueChart data={revenueData} />
        </div>
      </Card>

      {/* Status + Top clients */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Invoice status breakdown</CardTitle>
          <div className="mt-4">
            {statusData.length > 0 ? <StatusChart data={statusData} /> : <p className="py-8 text-center text-sm text-neutral-400">No data</p>}
          </div>
        </Card>

        <Card>
          <CardTitle>Top clients by revenue</CardTitle>
          <div className="mt-4">
            {topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, #e5e5e5)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#a3a3a3" }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#737373" }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]} animationDuration={800}>
                    {topClients.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-neutral-400">No client data</p>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard minRole="manager">
      <ReportsContent />
    </AuthGuard>
  );
}
