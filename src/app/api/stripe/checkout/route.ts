import { NextResponse } from "next/server";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { hasPermission, type Role } from "@/config/roles";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  PRICE_IDS,
} from "@/lib/stripe/client";
import { buildAppUrl } from "@/lib/utils/constants";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, plan } = await request.json();

    if (!orgId || !plan || !["pro", "enterprise"].includes(plan)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    if (!priceId) {
      return NextResponse.json({ error: "Price not configured" }, { status: 400 });
    }

    // Verify user can manage billing for the org
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

    // Get org details
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      org.id,
      org.name,
      user.email!,
      org.stripe_customer_id
    );

    // Save customer ID to org if new
    if (customerId !== org.stripe_customer_id) {
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);
    }

    // Create checkout session
    const url = await createCheckoutSession(
      customerId,
      priceId,
      orgId,
      buildAppUrl("/settings/billing"),
      buildAppUrl("/settings/billing")
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
