import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between bg-neutral-950 p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <span className="text-sm font-bold text-neutral-900">V</span>
          </div>
          <span className="text-lg font-semibold text-white">VaultFlow</span>
        </Link>

        <div>
          <blockquote className="space-y-4">
            <p className="text-xl leading-relaxed text-neutral-300">
              &ldquo;VaultFlow transformed how we manage invoicing. The dashboard gives
              us instant visibility into cash flow, and the automated reminders have
              cut our late payments by 60%.&rdquo;
            </p>
            <footer className="text-sm text-neutral-500">
              — Sarah Chen, CFO at Meridian Labs
            </footer>
          </blockquote>
        </div>

        <p className="text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} VaultFlow. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
                <span className="text-sm font-bold text-white dark:text-neutral-900">V</span>
              </div>
              <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                VaultFlow
              </span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
