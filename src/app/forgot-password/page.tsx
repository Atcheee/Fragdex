import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Reset password — This or That" };

export default function ForgotPasswordPage() {
  return <AuthPanel mode="forgot" />;
}
