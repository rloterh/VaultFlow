"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BarChart3,
    title: "Real-time analytics",
    description: "Track revenue, expenses, and cash flow with interactive dashboards updated in real time.",
  },
  {
    icon: FileText,
    title: "Smart invoicing",
    description: "Generate professional invoices, automate reminders, and accept payments via Stripe.",
  },
  {
    icon: Shield,
    title: "Enterprise security",
    description: "Role-based access control, row-level security, and SOC 2 compliant infrastructure.",
  },
  {
    icon: Zap,
    title: "Blazing performance",
    description: "Built on Next.js with SSR, ISR, and edge caching for sub-second page loads.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200/60 bg-white/80 backdrop-blur-lg dark:border-neutral-800/60 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 dark:bg-white">
              <span className="text-xs font-bold text-white dark:text-neutral-900">V</span>
            </div>
            <span className="text-sm font-semibold">VaultFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
        >
          <div className="mb-6 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <Zap className="mr-2 h-3.5 w-3.5" />
            Now with Stripe integration
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl dark:text-white">
            Financial clarity for{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              modern teams
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
            Track revenue, manage invoices, and gain real-time financial insights — all from one
            beautifully crafted dashboard.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Start free trial
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                View demo
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Dashboard preview placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="mt-20 w-full max-w-4xl"
        >
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-2xl shadow-neutral-200/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
            <div className="flex h-8 items-center gap-1.5 border-b border-neutral-200 px-4 dark:border-neutral-800">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Dashboard preview — Phase 2
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="border-t border-neutral-200 bg-neutral-50 py-24 dark:border-neutral-800 dark:bg-neutral-900/30">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={item}>
                <div className="rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="mb-4 inline-flex rounded-lg bg-neutral-100 p-2.5 dark:bg-neutral-800">
                    <feature.icon className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} VaultFlow. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-neutral-500">
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">Privacy</a>
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
