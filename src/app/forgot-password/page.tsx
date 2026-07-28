import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Reset password — Scenthub" };

export default function ForgotPasswordPage() {
  return <AuthPanel mode="forgot" />;
}
