import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/env";
import {
  DEFAULT_OAUTH_PROVIDER_SETTINGS,
  parseOAuthProviderSettings,
} from "@/lib/supabase/provider-settings";

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(DEFAULT_OAUTH_PROVIDER_SETTINGS, {
        status: 200,
      });
    }

    const payload = await response.json();

    return NextResponse.json(parseOAuthProviderSettings(payload));
  } catch {
    return NextResponse.json(DEFAULT_OAUTH_PROVIDER_SETTINGS, {
      status: 200,
    });
  }
}
