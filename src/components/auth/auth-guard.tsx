"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { type Permission, type Role } from "@/config/roles";
import { Skeleton } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  /** Require a specific permission */
  permission?: Permission;
  /** Require a minimum role level */
  minRole?: Role;
  /** Component to show when access is denied (default: built-in) */
  fallback?: ReactNode;
  /** Show skeleton while loading (default: true) */
  showSkeleton?: boolean;
}

export function AuthGuard({
  children,
  permission,
  minRole,
  fallback,
  showSkeleton = true,
}: AuthGuardProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const { can, hasRole } = usePermissions();

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Middleware handles redirect
  }

  // Check permission
  if (permission && !can(permission)) {
    return (
      fallback ?? (
        <AccessDenied message="You don't have permission to view this content." />
      )
    );
  }

  // Check minimum role
  if (minRole && !hasRole(minRole)) {
    return (
      fallback ?? (
        <AccessDenied message={`This section requires ${minRole} access or higher.`} />
      )
    );
  }

  return <>{children}</>;
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
        <Lock className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
        Access restricted
      </h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        {message}
      </p>
    </div>
  );
}

/**
 * Conditionally render content based on permission.
 * Use for inline elements like buttons and menu items.
 */
export function PermissionGate({
  children,
  permission,
  minRole,
}: {
  children: ReactNode;
  permission?: Permission;
  minRole?: Role;
}) {
  const { can, hasRole } = usePermissions();

  if (permission && !can(permission)) return null;
  if (minRole && !hasRole(minRole)) return null;

  return <>{children}</>;
}
