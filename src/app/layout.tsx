import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { ToastContainer } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VaultFlow — Financial Dashboard & Invoicing",
    template: "%s — VaultFlow",
  },
  description:
    "Enterprise-grade financial dashboard and invoice management platform. Track revenue, manage clients, and automate invoicing.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "VaultFlow",
    description: "Enterprise-grade financial dashboard & invoicing platform.",
    type: "website",
    locale: "en_US",
    siteName: "VaultFlow",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaultFlow",
    description: "Enterprise-grade financial dashboard & invoicing platform.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-white font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <SupabaseProvider>
          {children}
          <ToastContainer />
        </SupabaseProvider>
      </body>
    </html>
  );
}
