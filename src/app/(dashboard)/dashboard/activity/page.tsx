"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, FileText, Users, CreditCard, Settings, UserPlus, Trash2, Edit, Send, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrgStore } from "@/stores/org-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface ActivityEntry {
  id: string;
  org_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string; email: string };
}

const actionIcons: Record<string, typeof Activity> = {
  "invoice.created": FileText,
  "invoice.sent": Send,
  "invoice.viewed": Eye,
  "invoice.paid": CreditCard,
  "invoice.deleted": Trash2,
  "client.created": Users,
  "client.updated": Edit,
  "member.invited": UserPlus,
  "member.removed": Trash2,
  "member.role_changed": Users,
  "org.updated": Settings,
};

const actionLabels: Record<string, string> = {
  "invoice.created": "Created invoice",
  "invoice.sent": "Sent invoice",
  "invoice.viewed": "Invoice viewed",
  "invoice.paid": "Invoice paid",
  "invoice.deleted": "Deleted invoice",
  "client.created": "Added client",
  "client.updated": "Updated client",
  "member.invited": "Invited member",
  "member.removed": "Removed member",
  "member.role_changed": "Changed role",
  "org.updated": "Updated settings",
};

type ActivityBadgeVariant = "success" | "info" | "danger";

const actionColors: Record<string, ActivityBadgeVariant> = {
  "invoice.paid": "success",
  "invoice.sent": "info",
  "invoice.deleted": "danger",
  "member.removed": "danger",
  "member.invited": "info",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ActivityPage() {
  const { currentOrg } = useOrgStore();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!currentOrg) return;
      const sb = getSupabaseBrowserClient();
      const { data } = await sb
        .from("activity_log")
        .select("*, actor:profiles(full_name, email)")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEntries((data ?? []) as ActivityEntry[]);
      setLoading(false);
    }
    fetch();
  }, [currentOrg]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Activity log</h1>
        <p className="mt-1 text-sm text-neutral-500">Recent actions across your organization.</p>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-2 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-500">No activity recorded yet.</p>
            <p className="mt-1 text-xs text-neutral-400">Actions like creating invoices and managing team members will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {entries.map((entry) => {
              const Icon = actionIcons[entry.action] ?? Activity;
              const label = actionLabels[entry.action] ?? entry.action;
              const color = actionColors[entry.action];
              const actorName = entry.actor?.full_name || entry.actor?.email || "System";
              const metadata = entry.metadata as { name?: string; email?: string; number?: string };
              const detail = metadata.name || metadata.email || metadata.number || "";

              return (
                <div key={entry.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Icon className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 dark:text-white">
                      <span className="font-medium">{actorName}</span>{" "}
                      <span className="text-neutral-500">{label.toLowerCase()}</span>
                      {detail && <span className="font-medium"> {detail}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">{formatRelativeTime(entry.created_at)}</p>
                  </div>
                  {color && <Badge variant={color} className="mt-1 shrink-0">{label.split(" ").pop()}</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
