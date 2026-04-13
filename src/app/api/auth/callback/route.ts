import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { error: bootstrapError } = await supabase.rpc("ensure_user_starter_workspace");
      if (bootstrapError) {
        console.error("Starter workspace bootstrap after auth callback failed:", bootstrapError);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
