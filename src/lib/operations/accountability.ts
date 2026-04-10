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
