"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_HIERARCHY,
  ROLE_METADATA,
  getRolePermissions,
  type Role,
} from "@/config/roles";

interface RolePolicyMatrixProps {
  currentRole?: Role | null;
  compact?: boolean;
}

export function RolePolicyMatrix({
  currentRole,
  compact = false,
}: RolePolicyMatrixProps) {
  return (
    <Card>
      <CardTitle>Role policy matrix</CardTitle>
      <CardDescription>
        A shared view of who can operate, govern, and monitor the workspace.
      </CardDescription>

      <div className={`mt-5 grid gap-4 ${compact ? "xl:grid-cols-2 2xl:grid-cols-3" : "xl:grid-cols-3"}`}>
        {ROLE_HIERARCHY.slice().reverse().map((role) => {
          const metadata = ROLE_METADATA[role];
          const permissions = getRolePermissions(role);

          return (
            <div
              key={role}
              className={`rounded-xl border p-4 ${
                currentRole === role
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200/70 dark:border-neutral-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{metadata.title}</p>
                  <p
                    className={`mt-2 text-sm ${
                      currentRole === role
                        ? "text-neutral-200 dark:text-neutral-600"
                        : "text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {metadata.description}
                  </p>
                </div>
                <Badge variant={currentRole === role ? "outline" : metadata.badgeVariant}>
                  {role}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                {metadata.capabilities.map((capability) => (
                  <p
                    key={capability}
                    className={
                      currentRole === role
                        ? "text-neutral-100 dark:text-neutral-700"
                        : "text-neutral-600 dark:text-neutral-300"
                    }
                  >
                    {capability}
                  </p>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {permissions.slice(0, compact ? 5 : 4).map((permission) => (
                  <span
                    key={permission}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      currentRole === role
                        ? "bg-white/15 text-white dark:bg-neutral-900/10 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {PERMISSION_LABELS[permission]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PERMISSION_GROUPS.map((group) => (
          <div
            key={group.label}
            className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              {group.label}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {PERMISSION_LABELS[permission]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
