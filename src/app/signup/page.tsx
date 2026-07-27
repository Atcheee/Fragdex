import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Create account — Fragdex" };

export default function SignupPage() {
  return <AuthPanel mode="signup" />;
}
