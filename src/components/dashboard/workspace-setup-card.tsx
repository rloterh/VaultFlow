"use client";

import { useMemo, useState } from "react";
import { Building2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { slugifyWorkspaceName } from "@/lib/onboarding/workspace";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";

interface WorkspaceSetupCardProps {
  userName?: string | null;
  onCreated?: () => Promise<void> | void;
}

export function WorkspaceSetupCard({ userName, onCreated }: WorkspaceSetupCardProps) {
  const router = useRouter();
  const createOrg = useOrgStore((state) => state.createOrg);
  const addToast = useUIStore((state) => state.addToast);
  const [name, setName] = useState(userName ? `${userName.split(" ")[0]}'s Workspace` : "");
  const [slug, setSlug] = useState(
    userName ? slugifyWorkspaceName(`${userName.split(" ")[0]} workspace`) : ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasEditedSlug, setHasEditedSlug] = useState(false);

  const slugHint = useMemo(() => slugifyWorkspaceName(name), [name]);

  async function handleCreateWorkspace(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedSlug = (hasEditedSlug ? slug : slugHint).trim();

    if (!trimmedName || !trimmedSlug) {
      addToast({
        type: "error",
        title: "Workspace details missing",
        description: "Add a workspace name and URL slug before continuing.",
      });
      return;
    }

    setIsLoading(true);
    const org = await createOrg(trimmedName, trimmedSlug);
    setIsLoading(false);

    if (!org) {
      addToast({
        type: "error",
        title: "Workspace could not be created",
        description: "Try a different slug or retry in a moment.",
      });
      return;
    }

    await onCreated?.();
    addToast({
      type: "success",
      title: "Workspace created",
      description: `${org.name} is ready for invoicing, billing, and analytics.`,
    });
    router.refresh();
  }

  return (
    <Card className="border-dashed border-neutral-300/80 bg-white/70 dark:border-neutral-700/80 dark:bg-neutral-950/40">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace setup
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-neutral-900 dark:text-white">
            Your account is live. Let&apos;s create the first workspace.
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            VaultFlow needs at least one workspace before the dashboard can load invoices,
            clients, billing signals, and reporting. Create a starter workspace here and we
            will drop you straight into the live operating view.
          </p>
        </div>

        <form onSubmit={handleCreateWorkspace} className="w-full max-w-md space-y-4">
          <Input
            label="Workspace name"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!hasEditedSlug) {
                setSlug(slugifyWorkspaceName(nextName));
              }
            }}
            placeholder="Acme Finance"
            leftIcon={<Building2 className="h-4 w-4" />}
          />
          <Input
            label="Workspace slug"
            value={hasEditedSlug ? slug : slugHint}
            onChange={(event) => {
              setHasEditedSlug(true);
              setSlug(slugifyWorkspaceName(event.target.value));
            }}
            placeholder="acme-finance"
            hint="Used for workspace URLs and should stay unique."
          />
          <Button type="submit" isLoading={isLoading} className="h-11 w-full">
            Create workspace
          </Button>
        </form>
      </div>
    </Card>
  );
}
