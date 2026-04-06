import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account — VaultFlow",
  description: "Create your VaultFlow account and start managing finances.",
};

export default function SignupPage() {
  return <SignupForm />;
}
