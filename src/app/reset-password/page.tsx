import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "New password — Scent Games" };

export default function ResetPasswordPage() {
  return <AuthPanel mode="reset" />;
}
