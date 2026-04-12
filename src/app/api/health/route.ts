import { NextResponse } from "next/server";
import { getRuntimeHealthSnapshot } from "@/lib/env";

export async function GET() {
  const snapshot = getRuntimeHealthSnapshot();
  const missing = Object.entries(snapshot.services)
    .filter(([, ready]) => !ready)
    .map(([service]) => service);

  const status = missing.length === 0 ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      app: {
        name: snapshot.appName,
        url: snapshot.appUrl,
      },
      services: snapshot.services,
      missing,
    },
    {
      status: missing.length === 0 ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
