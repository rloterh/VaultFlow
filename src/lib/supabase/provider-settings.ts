export const OAUTH_PROVIDERS = ["google", "github"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type OAuthProviderSettings = Record<OAuthProvider, boolean>;

export const DEFAULT_OAUTH_PROVIDER_SETTINGS: OAuthProviderSettings = {
  google: true,
  github: true,
};

export function parseOAuthProviderSettings(payload: unknown): OAuthProviderSettings {
  const external =
    typeof payload === "object" &&
    payload !== null &&
    "external" in payload &&
    typeof (payload as { external?: unknown }).external === "object" &&
    (payload as { external?: unknown }).external !== null
      ? ((payload as { external: Record<string, unknown> }).external ?? {})
      : {};

  return {
    google: external.google === true,
    github: external.github === true,
  };
}
