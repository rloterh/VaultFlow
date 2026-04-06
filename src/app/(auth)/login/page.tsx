import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In — VaultFlow",
  description: "Sign in to your VaultFlow account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
