"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_URL } from "@/lib/utils/constants";

export default function ForgotPasswordPage() {
  const addToast = useUIStore((s) => s.addToast);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/api/auth/callback?next=/settings`,
    });

    setIsLoading(false);

    if (error) {
      addToast({ type: "error", title: "Failed to send reset email", description: error.message });
      return;
    }

    setSent(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-sm"
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
            <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <Link href="/login" className="mt-6 inline-block">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Reset password
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
            />
            <Button type="submit" isLoading={isLoading} className="w-full h-11">
              Send reset link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link
              href="/login"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </motion.div>
  );
}
