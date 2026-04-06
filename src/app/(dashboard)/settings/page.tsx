"use client";

import { motion } from "framer-motion";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useOrgStore } from "@/stores/org-store";

export default function SettingsPage() {
  const { profile } = useAuth();
  const { currentOrg } = useOrgStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your account and organization.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal account information.</CardDescription>
        <div className="mt-6 space-y-4">
          <Input label="Full name" defaultValue={profile?.full_name ?? ""} />
          <Input label="Email" defaultValue={profile?.email ?? ""} disabled />
          <div className="flex justify-end">
            <Button>Save changes</Button>
          </div>
        </div>
      </Card>

      {/* Organization */}
      {currentOrg && (
        <Card>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Settings for {currentOrg.name}.</CardDescription>
          <div className="mt-6 space-y-4">
            <Input label="Organization name" defaultValue={currentOrg.name} />
            <Input label="Slug" defaultValue={currentOrg.slug} hint="Used in URLs" />
            <div className="flex justify-end">
              <Button>Update organization</Button>
            </div>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
