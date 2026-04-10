"use client";

import { Archive, Copy, FilePlus2, Mail, UserRoundSearch } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { recordActivity } from "@/lib/activity/log";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import type { Client } from "@/types/database";

interface ClientRowActionsProps {
  client: Client;
  onUpdated: () => void | Promise<void>;
}

export function ClientRowActions({
  client,
  onUpdated,
}: ClientRowActionsProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    addToast({
      type: "success",
      title: `${label} copied`,
      description: value,
    });
  }

  async function archiveClient() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("clients")
      .update({ is_active: false })
      .eq("id", client.id);

    if (error) {
      addToast({
        type: "error",
        title: "Unable to archive client",
        description: error.message,
      });
      return;
    }

    addToast({
      type: "success",
      title: "Client archived",
      description: `${client.name} is now hidden from active workflow lists.`,
    });
    await recordActivity({
      orgId: client.org_id,
      userId: user?.id,
      entityType: "client",
      entityId: client.id,
      action: "client.archived",
      metadata: {
        client_name: client.name,
        email: client.email,
      },
    });
    await onUpdated();
  }

  return (
    <ActionMenu
      triggerLabel={`Open actions for ${client.name}`}
      sections={[
        {
          items: [
            {
              label: "Open profile",
              description: "Review revenue history and invoice activity.",
              href: `/dashboard/clients/${client.id}`,
              icon: UserRoundSearch,
            },
            {
              label: "Email client",
              description: "Compose a message using the default mail app.",
              href: `mailto:${client.email}`,
              external: true,
              icon: Mail,
            },
            ...(can("invoices:create")
              ? [
                  {
                    label: "Create invoice",
                    description: "Open the invoice composer for this account.",
                    href: `/dashboard/invoices?compose=1&clientId=${client.id}`,
                    icon: FilePlus2,
                  },
                ]
              : []),
            {
              label: "Copy email",
              description: "Use the billing contact in another system.",
              icon: Copy,
              onSelect: () => copyValue(client.email, "Client email"),
            },
          ],
        },
        ...(can("clients:delete")
          ? [
              {
                label: "Lifecycle",
                items: [
                  {
                    label: "Archive client",
                    description: "Remove this client from active account views.",
                    icon: Archive,
                    tone: "danger" as const,
                    onSelect: archiveClient,
                  },
                ],
              },
            ]
          : []),
      ]}
    />
  );
}
