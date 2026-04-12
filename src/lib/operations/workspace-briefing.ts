import type { CollectionsQueuePreset } from "@/lib/collections/queue";
import type {
  ClientHealthFilter,
  ClientTouchFilter,
} from "@/lib/operations/client-views";

type BriefingTone = "info" | "success" | "warning" | "danger";

export interface ClientWorkspaceBriefingStat {
  label: string;
  value: string;
  detail: string;
}

export interface ClientWorkspaceBriefing {
  tone: BriefingTone;
  title: string;
  detail: string;
  recommendations: string[];
  stats: ClientWorkspaceBriefingStat[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

function getTouchLabel(touchFilter: ClientTouchFilter) {
  if (touchFilter === "all") return "all touchpoints";
  if (touchFilter === "untouched") return "untouched accounts";
  if (touchFilter === "recent") return "recently touched accounts";
  return "stale follow-up accounts";
}

export function buildClientWorkspaceBriefing({
  label,
  healthFilter,
  queuePreset,
  touchFilter,
  accounts,
  openExposure,
  needsTouch,
  overdue,
  unreminded,
  untouched,
  stale,
}: {
  label: string;
  healthFilter: ClientHealthFilter;
  queuePreset: CollectionsQueuePreset;
  touchFilter: ClientTouchFilter;
  accounts: number;
  openExposure: number;
  needsTouch: number;
  overdue: number;
  unreminded: number;
  untouched: number;
  stale: number;
}): ClientWorkspaceBriefing {
  if (accounts === 0) {
    return {
      tone: "warning",
      title: `${label} is empty right now`,
      detail:
        "No accounts match the current saved view. Broaden the filters or reopen a wider workspace slice to restore coverage.",
      recommendations: [
        "Use All Accounts when you need a broader roster before narrowing back down.",
        "Re-check health and touchpoint filters if this view is meant for active collections work.",
      ],
      stats: [
        {
          label: "Accounts in scope",
          value: "0",
          detail: "No active client rows match the current posture.",
        },
        {
          label: "Open exposure",
          value: fmt(0),
          detail: "There is no open receivables exposure inside this slice.",
        },
        {
          label: "Queue pressure",
          value: "0",
          detail: "Nothing currently needs operator follow-up here.",
        },
      ],
    };
  }

  const stats: ClientWorkspaceBriefingStat[] = [
    {
      label: "Accounts in scope",
      value: String(accounts),
      detail: `${healthFilter === "all" ? "Mixed-health" : healthFilter} accounts with ${getTouchLabel(touchFilter)}.`,
    },
    {
      label: "Open exposure",
      value: fmt(openExposure),
      detail:
        overdue > 0
          ? `${overdue} overdue account${overdue === 1 ? "" : "s"} are driving collections risk.`
          : "Exposure is concentrated in active but not overdue work.",
    },
    {
      label: "Queue pressure",
      value: String(needsTouch),
      detail:
        queuePreset === "overdue"
          ? "Accounts in this view are already escalated into recovery."
          : queuePreset === "unreminded"
            ? "This slice is focused on first-touch reminder coverage."
            : "Accounts currently carrying follow-up work.",
    },
  ];

  const recommendations: string[] = [];

  if (overdue > 0) {
    recommendations.push(
      `${overdue} overdue account${overdue === 1 ? "" : "s"} should be reviewed in invoice recovery next.`
    );
  }

  if (untouched > 0 || unreminded > 0) {
    const firstTouchCount = Math.max(untouched, unreminded);
    recommendations.push(
      `Prioritize first reminder coverage for ${firstTouchCount} account${firstTouchCount === 1 ? "" : "s"} with no logged touchpoint.`
    );
  }

  if (stale > 0) {
    recommendations.push(
      `Refresh outreach on ${stale} stale account${stale === 1 ? "" : "s"} before the queue ages further.`
    );
  }

  if (recommendations.length === 0 && openExposure > 0) {
    recommendations.push(
      "This slice is stable enough for monitoring. Open matching reports if you need a broader trend read instead of immediate intervention."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No urgent collections pressure is visible here. Use this view for periodic health review and relationship monitoring."
    );
  }

  if (overdue > 0) {
    return {
      tone: "danger",
      title: `${label} is carrying active recovery pressure`,
      detail:
        "Overdue accounts are present in the current workspace slice, so the priority should stay on recovery coverage and owner follow-through.",
      recommendations,
      stats,
    };
  }

  if (needsTouch > 0) {
    return {
      tone: "warning",
      title: `${label} still needs operator follow-up`,
      detail:
        "Accounts in this slice are open and require touchpoint discipline, even if they have not slipped fully into overdue recovery yet.",
      recommendations,
      stats,
    };
  }

  if (openExposure > 0) {
    return {
      tone: "info",
      title: `${label} is open but stable`,
      detail:
        "The current workspace has live receivables exposure, but it is not showing strong collections stress signals right now.",
      recommendations,
      stats,
    };
  }

  return {
    tone: "success",
    title: `${label} is in a healthy operating posture`,
    detail:
      "The current workspace slice is not carrying open receivables pressure, so operators can use it as a monitoring lens instead of an intervention queue.",
    recommendations,
    stats,
  };
}
