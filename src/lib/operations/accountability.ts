import type { CollectionsQueueItem } from "@/lib/collections/queue";

export interface WorkflowActivityLike {
  entity_id: string;
  action: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface WorkflowAccountabilitySummary {
  ownerName: string | null;
  lastActorName: string | null;
  lastAction: string | null;
  lastTouchedAt: string | null;
}

export interface QueueAccountabilitySummary {
  staleOwned: number;
  unowned: number;
  untouchedOverdue: number;
  activeRecently: number;
}

export function buildWorkflowAccountabilityMap(
  entries: WorkflowActivityLike[]
) {
  const summaryMap = new Map<string, WorkflowAccountabilitySummary>();

  for (const entry of entries) {
    const actorName = entry.profile?.full_name ?? null;
    const current = summaryMap.get(entry.entity_id);

    if (!current) {
      summaryMap.set(entry.entity_id, {
        ownerName: entry.action === "invoice.created" ? actorName : null,
        lastActorName: actorName,
        lastAction: entry.action,
        lastTouchedAt: entry.created_at,
      });
      continue;
    }

    if (
      !current.lastTouchedAt ||
      new Date(entry.created_at).getTime() >
        new Date(current.lastTouchedAt).getTime()
    ) {
      current.lastActorName = actorName;
      current.lastAction = entry.action;
      current.lastTouchedAt = entry.created_at;
    }

    if (!current.ownerName && entry.action === "invoice.created") {
      current.ownerName = actorName;
    }
  }

  for (const summary of summaryMap.values()) {
    if (!summary.ownerName) {
      summary.ownerName = summary.lastActorName;
    }
  }

  return summaryMap;
}

function getDaysSince(value: string) {
  return Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function summarizeQueueAccountability(
  items: CollectionsQueueItem[],
  accountabilityMap: Map<string, WorkflowAccountabilitySummary>
): QueueAccountabilitySummary {
  return items.reduce<QueueAccountabilitySummary>(
    (summary, item) => {
      const accountability = accountabilityMap.get(item.invoice.id);
      const lastTouchedAt = accountability?.lastTouchedAt ?? null;
      const hasOwner = Boolean(accountability?.ownerName);
      const daysSinceLastTouch = lastTouchedAt ? getDaysSince(lastTouchedAt) : null;

      if (!hasOwner) {
        summary.unowned += 1;
      }

      if (item.invoice.status === "overdue" && item.reminderCount === 0) {
        summary.untouchedOverdue += 1;
      }

      if (hasOwner && (daysSinceLastTouch === null || daysSinceLastTouch > 7)) {
        summary.staleOwned += 1;
      }

      if (daysSinceLastTouch !== null && daysSinceLastTouch <= 3) {
        summary.activeRecently += 1;
      }

      return summary;
    },
    {
      staleOwned: 0,
      unowned: 0,
      untouchedOverdue: 0,
      activeRecently: 0,
    }
  );
}
