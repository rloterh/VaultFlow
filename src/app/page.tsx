"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BarChart3,
    title: "Real-time analytics",
    description:
      "Track revenue, cash exposure, and billing activity across a polished operational command center.",
  },
  {
    icon: FileText,
    title: "Smart invoicing",
    description:
      "Create branded invoices, manage status lifecycles, export PDFs, and keep collections moving.",
  },
  {
    icon: Shield,
    title: "Enterprise controls",
    description:
      "RBAC, audit activity, admin governance, and tenant-aware access patterns built for scale.",
  },
  {
    icon: Zap,
    title: "Modern performance",
    description:
      "Designed for fast iteration with Next.js, Supabase realtime, and resilient SaaS-ready workflows.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

function PreviewCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-neutral-900/80">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(to_bottom,_#ffffff,_#f5f7fb)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_32%),linear-gradient(to_bottom,_#09090b,_#050507)]">
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
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
        >
          <div className="mb-6 inline-flex items-center rounded-full border border-neutral-200 bg-white/90 px-4 py-1.5 text-sm text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Multi-tenant billing operations with realtime analytics
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl dark:text-white">
            Financial operations software for
            <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {" "}
              modern SaaS teams
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
            VaultFlow combines invoicing, subscriptions, analytics, and admin governance into a
            clean enterprise workspace designed to scale with finance-heavy product teams.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Launch workspace
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Enter demo
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
          className="mt-20 w-full max-w-5xl"
        >
          <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white/75 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85 dark:shadow-[0_40px_120px_-50px_rgba(0,0,0,0.75)]">
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-5 py-4 dark:border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Revenue command center
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Live financial posture across invoices, billing, and team operations
                </p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                Realtime sync enabled
              </div>
            </div>

            <div className="grid gap-5 bg-[linear-gradient(to_bottom_right,_rgba(248,250,252,0.9),_rgba(240,249,255,0.8))] p-6 dark:bg-[linear-gradient(to_bottom_right,_rgba(9,9,11,0.9),_rgba(15,23,42,0.72))] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <PreviewCard label="Collected revenue" value="$184,200" tone="text-neutral-900 dark:text-white" />
                  <PreviewCard label="Outstanding" value="$26,480" tone="text-amber-500" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/80 p-5 dark:bg-neutral-900/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        6 month revenue trend
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Strong collections momentum with predictable SaaS billing throughput
                      </p>
                    </div>
                    <div className="text-sm font-medium text-emerald-500">+18.4%</div>
                  </div>
                  <div className="mt-5 flex h-44 items-end gap-3">
                    {[38, 54, 49, 65, 73, 88].map((height, index) => (
                      <div key={height} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className={`w-full rounded-t-2xl bg-gradient-to-t ${
                            index === 5
                              ? "from-blue-600 to-cyan-400"
                              : "from-neutral-300 to-neutral-200 dark:from-neutral-700 dark:to-neutral-600"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">
                          {["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/80 p-5 dark:bg-neutral-900/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Attention queue
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Items requiring operator action right now
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      7 live tasks
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      ["INV-240310-612", "Overdue · Meridian Labs", "text-amber-500"],
                      ["Seat expansion", "2 invites pending approval", "text-blue-500"],
                      ["Enterprise billing", "Portal health · active", "text-emerald-500"],
                    ].map(([title, meta, color]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-white/70 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/70"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{title}</p>
                          <p className="mt-1 text-xs text-neutral-500">{meta}</p>
                        </div>
                        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/80 p-5 dark:bg-neutral-900/80">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Plan and governance
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
                      <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">Plan</p>
                      <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                        Enterprise
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">Unlimited invoices and audit controls</p>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
                      <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">Access</p>
                      <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                        14 active seats
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">Owners, admins, finance managers, managers, vendors, viewers, and members</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="border-t border-neutral-200 bg-white/70 py-24 dark:border-neutral-800 dark:bg-neutral-900/30">
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
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="mb-4 inline-flex rounded-xl bg-neutral-100 p-2.5 dark:bg-neutral-800">
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

      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} VaultFlow. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-neutral-500">
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">
              Privacy
            </a>
            <a href="#" className="hover:text-neutral-900 dark:hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
