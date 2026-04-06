"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "./oauth-buttons";

export function SignupForm() {
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Name is required";
    if (!form.email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Invalid email address";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8)
      errs.password = "Must be at least 8 characters";
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      errs.password = "Must include upper, lower, and number";
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = "Passwords don't match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
        },
      },
    });

    if (error) {
      addToast({ type: "error", title: "Signup failed", description: error.message });
      setIsLoading(false);
      return;
    }

    addToast({
      type: "success",
      title: "Account created!",
      description: "Check your email to verify your account.",
    });
    router.push("/login");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-sm"
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Start managing your finances with VaultFlow
        </p>
      </div>

      <OAuthButtons />

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
            or sign up with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          error={errors.fullName}
          leftIcon={<User className="h-4 w-4" />}
          autoComplete="name"
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          leftIcon={<Mail className="h-4 w-4" />}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          hint="Min 8 chars, upper + lower + number"
          leftIcon={<Lock className="h-4 w-4" />}
          autoComplete="new-password"
        />

        <Input
          label="Confirm password"
          type="password"
          placeholder="••••••••"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          leftIcon={<Lock className="h-4 w-4" />}
          autoComplete="new-password"
        />

        <Button type="submit" isLoading={isLoading} className="w-full h-11">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-neutral-900 hover:underline dark:text-white"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
