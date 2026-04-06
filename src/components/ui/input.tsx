"use client";

import { forwardRef, type InputHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, type, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm",
              "transition-colors duration-200",
              "placeholder:text-neutral-400",
              "focus:outline-none focus:ring-2 focus:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:bg-neutral-900 dark:text-neutral-100",
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-700"
                : "border-neutral-200 focus:border-neutral-900 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-neutral-400",
              leftIcon && "pl-10",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
