import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Create account — Scenthub" };

export default function SignupPage() {
  return <AuthPanel mode="signup" />;
}
