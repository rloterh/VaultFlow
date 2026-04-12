export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "VaultFlow";

function normalizeAppUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export const APP_URL = normalizeAppUrl(
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
);

export function buildAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(normalizedPath, `${APP_URL}/`).toString();
}

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  callback: "/api/auth/callback",
} as const;

export const PROTECTED_ROUTES = ["/dashboard", "/settings", "/invoices", "/clients", "/reports"];
export const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

export const PLANS = {
  free: { name: "Free", price: 0, invoiceLimit: 10, memberLimit: 2 },
  pro: { name: "Pro", price: 29, invoiceLimit: 500, memberLimit: 10 },
  enterprise: { name: "Enterprise", price: 99, invoiceLimit: -1, memberLimit: -1 },
} as const;
