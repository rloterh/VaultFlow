import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "outlined" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  className,
  variant = "elevated",
  padding = "md",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        {
          elevated:
            "border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
          outlined:
            "border border-neutral-200 bg-transparent dark:border-neutral-700",
          ghost: "bg-neutral-50 dark:bg-neutral-800/50",
        }[variant],
        {
          none: "",
          sm: "p-3",
          md: "p-5",
          lg: "p-7",
        }[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold text-neutral-900 dark:text-neutral-100", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-sm text-neutral-500 dark:text-neutral-400", className)}
      {...props}
    />
  );
}
