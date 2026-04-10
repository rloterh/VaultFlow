import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

// ============================================
// BADGE
// ============================================
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        {
          default: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
          success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          info: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          outline:
            "border border-neutral-200 bg-transparent text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

// ============================================
// AVATAR
// ============================================
interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
];

function getAvatarColor(name: string | null | undefined): string {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

export function Avatar({ src, name, size = "md", className, ...props }: AvatarProps) {
  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];

  if (src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-full",
          sizeClasses,
          className
        )}
        {...props}
      >
        <Image
          src={src}
          alt={name ?? "Avatar"}
          fill
          sizes={
            size === "sm" ? "28px" : size === "md" ? "36px" : "48px"
          }
          unoptimized
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-medium",
        sizeClasses,
        getAvatarColor(name),
        className
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}

// ============================================
// SKELETON
// ============================================
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800",
        className
      )}
      {...props}
    />
  );
}
