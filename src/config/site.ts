export const siteConfig = {
  name: "VaultFlow",
  description: "Enterprise-grade financial dashboard and invoice management platform.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og.png",
  links: {
    github: "https://github.com/yourusername/vaultflow",
  },
  creator: "Your Name",
};

export type SiteConfig = typeof siteConfig;
