import { describe, expect, it } from "vitest";
import {
  DEFAULT_OAUTH_PROVIDER_SETTINGS,
  parseOAuthProviderSettings,
} from "@/lib/supabase/provider-settings";

describe("oauth provider settings", () => {
  it("parses enabled providers from supabase auth settings", () => {
    expect(
      parseOAuthProviderSettings({
        external: {
          google: true,
          github: false,
        },
      })
    ).toEqual({
      google: true,
      github: false,
    });
  });

  it("treats missing or malformed settings as disabled", () => {
    expect(parseOAuthProviderSettings({})).toEqual({
      google: false,
      github: false,
    });
    expect(parseOAuthProviderSettings(null)).toEqual({
      google: false,
      github: false,
    });
  });

  it("keeps optimistic defaults separate from parsed settings", () => {
    expect(DEFAULT_OAUTH_PROVIDER_SETTINGS).toEqual({
      google: true,
      github: true,
    });
  });
});
