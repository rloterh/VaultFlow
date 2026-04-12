import { afterEach, describe, expect, it, vi } from "vitest";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

async function loadConstants() {
  vi.resetModules();

  return import("@/lib/utils/constants");
}

describe("app url helpers", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("normalizes a trailing slash in NEXT_PUBLIC_APP_URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://vaultflow-weld.vercel.app/";

    const { APP_URL } = await loadConstants();

    expect(APP_URL).toBe("https://vaultflow-weld.vercel.app");
  });

  it("builds canonical app urls without double slashes", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://vaultflow-weld.vercel.app/";

    const { buildAppUrl } = await loadConstants();

    expect(buildAppUrl("/api/auth/callback")).toBe(
      "https://vaultflow-weld.vercel.app/api/auth/callback"
    );
    expect(buildAppUrl("settings/billing")).toBe(
      "https://vaultflow-weld.vercel.app/settings/billing"
    );
  });
});
