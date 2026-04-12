const SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";
const APP_URL_KEY = "NEXT_PUBLIC_APP_URL";
const APP_NAME_KEY = "NEXT_PUBLIC_APP_NAME";
const STRIPE_SECRET_KEY = "STRIPE_SECRET_KEY";
const STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET";
const STRIPE_PUBLISHABLE_KEY = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";
const STRIPE_PRO_PRICE_ID = "STRIPE_PRO_PRICE_ID";
const STRIPE_ENTERPRISE_PRICE_ID = "STRIPE_ENTERPRISE_PRICE_ID";

function readEnv(name: string) {
  const value = (() => {
    switch (name) {
      case SUPABASE_URL_KEY:
        return process.env.NEXT_PUBLIC_SUPABASE_URL;
      case SUPABASE_ANON_KEY:
        return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      case SUPABASE_SERVICE_ROLE_KEY:
        return process.env.SUPABASE_SERVICE_ROLE_KEY;
      case APP_URL_KEY:
        return process.env.NEXT_PUBLIC_APP_URL;
      case APP_NAME_KEY:
        return process.env.NEXT_PUBLIC_APP_NAME;
      case STRIPE_SECRET_KEY:
        return process.env.STRIPE_SECRET_KEY;
      case STRIPE_WEBHOOK_SECRET:
        return process.env.STRIPE_WEBHOOK_SECRET;
      case STRIPE_PUBLISHABLE_KEY:
        return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      case STRIPE_PRO_PRICE_ID:
        return process.env.STRIPE_PRO_PRICE_ID;
      case STRIPE_ENTERPRISE_PRICE_ID:
        return process.env.STRIPE_ENTERPRISE_PRICE_ID;
      default:
        return undefined;
    }
  })();

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requireEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function hasSupabaseConfig() {
  return Boolean(readEnv(SUPABASE_URL_KEY) && readEnv(SUPABASE_ANON_KEY));
}

export function getSupabaseConfig() {
  return {
    url: requireEnv(SUPABASE_URL_KEY),
    anonKey: requireEnv(SUPABASE_ANON_KEY),
  };
}

export function getSupabaseServiceRoleKey() {
  return requireEnv(SUPABASE_SERVICE_ROLE_KEY);
}

export function getAppUrl() {
  return readEnv(APP_URL_KEY) ?? "http://localhost:3000";
}

export function getAppName() {
  return readEnv(APP_NAME_KEY) ?? "VaultFlow";
}

export function getStripeSecretKey() {
  return requireEnv(STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret() {
  return requireEnv(STRIPE_WEBHOOK_SECRET);
}

export function hasStripePublishableKey() {
  return Boolean(readEnv(STRIPE_PUBLISHABLE_KEY));
}

export function hasStripeSecretConfig() {
  return Boolean(readEnv(STRIPE_SECRET_KEY) && readEnv(STRIPE_WEBHOOK_SECRET));
}

export function hasStripePriceConfig() {
  return Boolean(
    readEnv(STRIPE_PRO_PRICE_ID) && readEnv(STRIPE_ENTERPRISE_PRICE_ID)
  );
}

export function getRuntimeHealthSnapshot() {
  return {
    appName: getAppName(),
    appUrl: getAppUrl(),
    services: {
      supabasePublic: hasSupabaseConfig(),
      supabaseServiceRole: Boolean(readEnv(SUPABASE_SERVICE_ROLE_KEY)),
      stripePublic: hasStripePublishableKey(),
      stripeSecret: hasStripeSecretConfig(),
      stripePrices: hasStripePriceConfig(),
    },
  };
}
