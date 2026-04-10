import type { CollectionsQueuePreset } from "@/lib/collections/queue";
import type { ClientHealthState } from "@/lib/clients/insights";

export type ClientHealthFilter = "all" | ClientHealthState;
export type ClientTouchFilter = "all" | "untouched" | "recent" | "stale";
export type ClientOpsViewId =
  | "all-accounts"
  | "collections-focus"
  | "at-risk-accounts"
  | "unreminded-open";

export interface ClientOpsViewDefinition {
  id: ClientOpsViewId;
  label: string;
  description: string;
  health: ClientHealthFilter;
  queuePreset: CollectionsQueuePreset;
}

export const DEFAULT_CLIENT_OPS_VIEW: ClientOpsViewId = "collections-focus";

export const CLIENT_OPS_VIEWS: ClientOpsViewDefinition[] = [
  {
    id: "collections-focus",
    label: "Collections Focus",
    description: "Open accounts currently carrying follow-up work.",
    health: "all",
    queuePreset: "needs-touch",
  },
  {
    id: "at-risk-accounts",
    label: "At-Risk Accounts",
    description: "Overdue accounts that need the fastest intervention.",
    health: "at-risk",
    queuePreset: "overdue",
  },
  {
    id: "unreminded-open",
    label: "Unreminded Open",
    description: "Open balances with no logged reminder touchpoint yet.",
    health: "all",
    queuePreset: "unreminded",
  },
  {
    id: "all-accounts",
    label: "All Accounts",
    description: "A complete account roster for broader relationship review.",
    health: "all",
    queuePreset: "all",
  },
];

export function isClientHealthFilter(
  value: string | null | undefined
): value is ClientHealthFilter {
  return ["all", "new", "healthy", "attention", "at-risk"].includes(value ?? "");
}

export function isCollectionsQueuePreset(
  value: string | null | undefined
): value is CollectionsQueuePreset {
  return ["all", "needs-touch", "overdue", "unreminded"].includes(value ?? "");
}

export function isClientTouchFilter(
  value: string | null | undefined
): value is ClientTouchFilter {
  return ["all", "untouched", "recent", "stale"].includes(value ?? "");
}

export function isClientOpsViewId(
  value: string | null | undefined
): value is ClientOpsViewId {
  return CLIENT_OPS_VIEWS.some((view) => view.id === value);
}

export function getClientOpsView(id?: string | null) {
  return (
    CLIENT_OPS_VIEWS.find((view) => view.id === id) ??
    CLIENT_OPS_VIEWS.find((view) => view.id === DEFAULT_CLIENT_OPS_VIEW)!
  );
}

export function findMatchingClientOpsView(
  health: ClientHealthFilter,
  queuePreset: CollectionsQueuePreset
) {
  return (
    CLIENT_OPS_VIEWS.find(
      (view) => view.health === health && view.queuePreset === queuePreset
    ) ?? null
  );
}

export function getClientOpsViewForQueuePreset(
  queuePreset: CollectionsQueuePreset
) {
  if (queuePreset === "overdue") {
    return "at-risk-accounts" satisfies ClientOpsViewId;
  }

  if (queuePreset === "unreminded") {
    return "unreminded-open" satisfies ClientOpsViewId;
  }

  if (queuePreset === "all") {
    return "all-accounts" satisfies ClientOpsViewId;
  }

  return "collections-focus" satisfies ClientOpsViewId;
}

export function buildClientOpsViewHref(
  id: ClientOpsViewId,
  overrides?: Partial<Pick<ClientOpsViewDefinition, "health" | "queuePreset">>
) {
  const view = getClientOpsView(id);
  const params = new URLSearchParams({
    view: id,
    health: overrides?.health ?? view.health,
    queue: overrides?.queuePreset ?? view.queuePreset,
  });

  return `/dashboard/clients?${params.toString()}`;
}

function getDaysSince(value: string) {
  return Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function matchesClientTouchFilter(
  latestReminderAt: string | null,
  hasOpenCollections: boolean,
  filter: ClientTouchFilter
) {
  if (filter === "all") {
    return true;
  }

  if (!hasOpenCollections) {
    return false;
  }

  if (filter === "untouched") {
    return latestReminderAt === null;
  }

  if (!latestReminderAt) {
    return false;
  }

  const daysSinceReminder = getDaysSince(latestReminderAt);

  if (filter === "recent") {
    return daysSinceReminder <= 7;
  }

  return daysSinceReminder > 7;
}
