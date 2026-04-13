import { describe, expect, it } from "vitest";
import { slugifyWorkspaceName } from "@/lib/onboarding/workspace";

describe("workspace onboarding helpers", () => {
  it("slugifies workspace names safely", () => {
    expect(slugifyWorkspaceName("Robert's Workspace")).toBe("robert-s-workspace");
    expect(slugifyWorkspaceName("  Finance Ops @ ACME  ")).toBe("finance-ops-acme");
  });

  it("limits slug length and strips unsupported edges", () => {
    expect(slugifyWorkspaceName("!!! VaultFlow Enterprise Workspace !!!")).toBe(
      "vaultflow-enterprise-workspace"
    );
    expect(
      slugifyWorkspaceName(
        "This is a very long workspace name that should be trimmed safely for slugs"
      ).length
    ).toBeLessThanOrEqual(48);
  });
});
