const SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";
const STRIPE_SECRET_KEY = "STRIPE_SECRET_KEY";
const STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET";

function readEnv(name: string) {
  const value = process.env[name];
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

export function getStripeSecretKey() {
  return requireEnv(STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret() {
  return requireEnv(STRIPE_WEBHOOK_SECRET);
}
