const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vaultflow.app";

export function applicationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VaultFlow",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Multi-tenant SaaS financial dashboard with invoice management, team collaboration, and real-time analytics.",
    url: BASE_URL,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "99",
      priceCurrency: "USD",
      offerCount: 3,
    },
    featureList: [
      "Invoice management with PDF generation",
      "Real-time financial dashboards",
      "Multi-tenant organization support",
      "Role-based access control",
      "Stripe subscription billing",
      "Client management",
      "Revenue reports and analytics",
    ],
    creator: {
      "@type": "Organization",
      name: "VaultFlow",
      url: BASE_URL,
    },
  });
}

export function organizationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "VaultFlow",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: "Financial dashboard and invoice management platform for modern businesses.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@vaultflow.app",
    },
  });
}

export function websiteJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "VaultFlow",
    url: BASE_URL,
    description: "Multi-tenant SaaS financial dashboard with invoice management and real-time analytics.",
    publisher: { "@type": "Organization", name: "VaultFlow" },
  });
}
