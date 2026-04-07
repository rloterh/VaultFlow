"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  DollarSign, FileText, Users, TrendingUp,
  Plus, ArrowUpRight, Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Skeleton } from "@/components/ui/badge";
import { RevenueChart, StatusChart } from "@/components/charts";
import { useAuth } from "@/hooks/use-auth";
import { useOrgStore } from "@/stores/org-store";
import { useInvoiceRealtime } from "@/lib/supabase/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DashboardStats, RevenueDataPoint, StatusDistribution, Invoice, ActivityEntry } from "@/types/database";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    const sb = getSupabaseBrowserClient();
    const [invRes, cliRes, actRes] = await Promise.all([
      sb.from("invoices").select("*, client:clients(id, name, company)").eq("org_id", currentOrg.id).order("created_at", { ascending: false }),
      sb.from("clients").select("*", { count: "exact", head: true }).eq("org_id", currentOrg.id).eq("is_active", true),
      sb.from("activity_log").select("*, profile:profiles(full_name, avatar_url)").eq("org_id", currentOrg.id).order("created_at", { ascending: false }).limit(8),
    ]);
    const invoices = (invRes.data ?? []) as Invoice[];
    setRecent(invoices.slice(0, 5));
    setActivity((actRes.data ?? []) as ActivityEntry[]);

    const paid = invoices.filter(i => i.status === "paid");
    const totalRev = paid.reduce((s, i) => s + Number(i.total), 0);
    const overdue = invoices.filter(i => i.status === "overdue");
    const overdueAmt = overdue.reduce((s, i) => s + Number(i.total), 0);
    setStats({
      totalRevenue: totalRev, revenueChange: 20.1,
      invoicesSent: invoices.filter(i => i.status !== "draft").length, invoicesChange: 12,
      activeClients: cliRes.count ?? 0, clientsChange: 3,
      overdueAmount: overdueAmt, overdueChange: -4.3,
    });

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const chart: RevenueDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mi = paid.filter((inv) => { const id = new Date(inv.issue_date); return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear(); });
      chart.push({ month: months[d.getMonth()], revenue: mi.reduce((s, inv) => s + Number(inv.total), 0), invoices: mi.length });
    }
    setRevenueData(chart);

    const smap = new Map<string, { count: number; amount: number }>();
    invoices.forEach(inv => { const e = smap.get(inv.status) ?? { count: 0, amount: 0 }; e.count++; e.amount += Number(inv.total); smap.set(inv.status, e); });
    setStatusData(Array.from(smap.entries()).map(([status, d]) => ({ status: status as any, count: d.count, amount: d.amount })));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useInvoiceRealtime(currentOrg?.id, fetchData);

  const name = profile?.full_name?.split(" ")[0] || "there";

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Good morning, {name}</h1>
          <p className="mt-1 text-sm text-neutral-500">Here&apos;s what&apos;s happening with your finances today.</p>
        </div>
        <Link href="/dashboard/invoices"><Button leftIcon={<Plus className="h-4 w-4" />}>New invoice</Button></Link>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Revenue" value={fmt(stats?.totalRevenue ?? 0)} change={`+${stats?.revenueChange}%`} trend="up" icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" index={0} />
        <MetricCard label="Invoices Sent" value={String(stats?.invoicesSent ?? 0)} change={`+${stats?.invoicesChange}`} trend="up" icon={FileText} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" index={1} />
        <MetricCard label="Active Clients" value={String(stats?.activeClients ?? 0)} change={`+${stats?.clientsChange}`} trend="up" icon={Users} iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" index={2} />
        <MetricCard label="Overdue" value={fmt(stats?.overdueAmount ?? 0)} change={`${stats?.overdueChange}%`} trend="down" icon={TrendingUp} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" index={3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card><h2 className="mb-4 text-base font-semibold text-neutral-900 dark:text-white">Revenue overview</h2><RevenueChart data={revenueData} /></Card>
        </motion.div>
        <motion.div variants={item} className="lg:col-span-3">
          <Card><h2 className="mb-4 text-base font-semibold text-neutral-900 dark:text-white">Invoice status</h2>{statusData.length > 0 ? <StatusChart data={statusData} /> : <p className="py-8 text-center text-sm text-neutral-400">No invoices yet</p>}</Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 pb-0">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Recent invoices</h2>
              <Link href="/dashboard/invoices"><Button variant="ghost" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>View all</Button></Link>
            </div>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
              {recent.map(inv => (
                <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <div><p className="text-sm font-medium text-neutral-900 dark:text-white">{inv.invoice_number}</p><p className="text-xs text-neutral-500">{(inv.client as any)?.name} &middot; {fmtDate(inv.issue_date)}</p></div>
                  <div className="flex items-center gap-3"><StatusBadge status={inv.status} /><span className="text-sm font-medium text-neutral-900 dark:text-white">{fmt(Number(inv.total))}</span></div>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-3">
          <Card padding="none">
            <div className="p-5 pb-0"><h2 className="text-base font-semibold text-neutral-900 dark:text-white">Activity</h2></div>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
              {activity.length === 0 ? <p className="px-5 py-8 text-center text-sm text-neutral-400">No activity yet</p> : activity.slice(0, 6).map(e => (
                <div key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={e.profile?.full_name} src={e.profile?.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300"><span className="font-medium">{e.profile?.full_name ?? "System"}</span> {e.action.replace(/_/g, " ")} <span className="font-medium">{(e.metadata as any)?.invoice_number ?? e.entity_type}</span></p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400"><Clock className="h-3 w-3" />{timeAgo(e.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
