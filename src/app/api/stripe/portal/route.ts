import { NextResponse } from "next/server";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { hasPermission, type Role } from "@/config/roles";
import { createPortalSession } from "@/lib/stripe/client";
import { buildAppUrl } from "@/lib/utils/constants";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await request.json();

    const supabase = await getSupabaseServerClient();
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .single();

    if (!membership || !hasPermission(membership.role as Role, "org:billing")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    const url = await createPortalSession(
      org.stripe_customer_id,
      buildAppUrl("/settings/billing")
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
