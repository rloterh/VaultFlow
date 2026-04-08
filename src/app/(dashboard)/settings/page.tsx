"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Globe, Bell, Trash2, Upload } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";

export default function SettingsPage() {
  const { profile } = useAuth();
  const { currentOrg } = useOrgStore();
  const { can } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const canEdit = can("settings:update");

  const [orgForm, setOrgForm] = useState({
    name: currentOrg?.name ?? "",
    slug: currentOrg?.slug ?? "",
  });
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    timezone: profile?.timezone ?? "UTC",
  });
  const [saving, setSaving] = useState<"org" | "profile" | null>(null);

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg || !canEdit) return;
    setSaving("org");
    const sb = getSupabaseBrowserClient();
    const { error } = await sb
      .from("organizations")
      .update({ name: orgForm.name, slug: orgForm.slug })
      .eq("id", currentOrg.id);
    if (error) addToast({ type: "error", title: "Failed to update", description: error.message });
    else addToast({ type: "success", title: "Organization updated" });
    setSaving(null);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving("profile");
    const sb = getSupabaseBrowserClient();
    const { error } = await sb
      .from("profiles")
      .update({ full_name: profileForm.full_name, phone: profileForm.phone, timezone: profileForm.timezone })
      .eq("id", profile.id);
    if (error) addToast({ type: "error", title: "Failed to update", description: error.message });
    else addToast({ type: "success", title: "Profile updated" });
    setSaving(null);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your account and organization.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal account details.</CardDescription>
        <form onSubmit={saveProfile} className="mt-6 space-y-4">
          <Input label="Full name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
          <Input label="Email" value={profile?.email ?? ""} disabled hint="Email cannot be changed here." />
          <Input label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Timezone</label>
            <select
              value={profileForm.timezone}
              onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              {["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"].map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={saving === "profile"}>Save profile</Button>
          </div>
        </form>
      </Card>

      {/* Organization */}
      {currentOrg && (
        <Card>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-neutral-400" />
            <CardTitle>Organization</CardTitle>
          </div>
          <CardDescription>Settings for {currentOrg.name}.</CardDescription>
          <form onSubmit={saveOrg} className="mt-6 space-y-4">
            <Input label="Organization name" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} disabled={!canEdit} />
            <Input label="URL slug" value={orgForm.slug} onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })} disabled={!canEdit} hint={`vaultflow.app/${orgForm.slug}`} />
            <Input label="Plan" value={currentOrg.plan.charAt(0).toUpperCase() + currentOrg.plan.slice(1)} disabled hint="Manage your plan in the Billing tab." />
            {canEdit && (
              <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={saving === "org"}>Save organization</Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-neutral-400" />
          <CardTitle>Notifications</CardTitle>
        </div>
        <CardDescription>Control what emails you receive.</CardDescription>
        <div className="mt-6 space-y-4">
          {[
            { label: "Invoice status changes", desc: "When an invoice is viewed, paid, or overdue", default: true },
            { label: "New team member joins", desc: "When someone accepts an invitation", default: true },
            { label: "Weekly revenue summary", desc: "A digest of your financial performance", default: false },
            { label: "Product updates", desc: "New features and improvements from VaultFlow", default: false },
          ].map((pref) => (
            <div key={pref.label} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{pref.label}</p>
                <p className="text-xs text-neutral-500">{pref.desc}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" defaultChecked={pref.default} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-neutral-900 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-white dark:peer-checked:after:bg-neutral-900" />
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      {canEdit && currentOrg && (
        <Card className="border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            <CardTitle className="text-red-600 dark:text-red-400">Danger zone</CardTitle>
          </div>
          <CardDescription>Irreversible actions for your organization.</CardDescription>
          <div className="mt-6 flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/30">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Delete organization</p>
              <p className="text-xs text-neutral-500">This will permanently delete all data including invoices, clients, and team members.</p>
            </div>
            <Button variant="danger" size="sm">Delete</Button>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
