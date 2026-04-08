import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vaultflow.app";

function ogImage(title: string, subtitle?: string) {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  return `${BASE_URL}/api/og?${params.toString()}`;
}

export const homeMetadata: Metadata = {
  title: "VaultFlow — Financial Dashboard & Invoice Platform",
  description: "Multi-tenant SaaS financial dashboard with invoice management, team collaboration, Stripe billing, and real-time analytics.",
  openGraph: {
    title: "VaultFlow",
    description: "Financial dashboard and invoice platform for modern businesses.",
    url: BASE_URL,
    siteName: "VaultFlow",
    images: [{ url: ogImage("VaultFlow", "Financial Dashboard & Invoice Platform"), width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const loginMetadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your VaultFlow account.",
};

export const signupMetadata: Metadata = {
  title: "Create Account",
  description: "Create a free VaultFlow account to manage invoices, track revenue, and collaborate with your team.",
};

export const dashboardMetadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your financial performance, recent invoices, and key metrics.",
};

export const invoicesMetadata: Metadata = {
  title: "Invoices",
  description: "Manage, create, and track invoices for your clients.",
};

export const clientsMetadata: Metadata = {
  title: "Clients",
  description: "Manage your client directory and view invoice history.",
};

export const reportsMetadata: Metadata = {
  title: "Reports",
  description: "Revenue trends, top clients, and financial analytics.",
};

export const settingsMetadata: Metadata = {
  title: "Settings",
  description: "Manage your organization settings, team members, and billing.",
};

export const adminMetadata: Metadata = {
  title: "Admin",
  description: "Platform administration — organization overview and member management.",
};
