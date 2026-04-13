import { NextResponse } from "next/server";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export async function POST() {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("ensure_user_starter_workspace");

  if (error) {
    console.error("Starter workspace bootstrap failed:", error);
    return NextResponse.json(
      { error: "Starter workspace bootstrap failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
