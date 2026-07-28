import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Log in — Scenthub" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "callback_failed"
      ? "That sign-in link could not be completed. Please try again."
      : error === "auth_not_configured"
        ? "Sign-in is not configured on this deployment yet."
        : "";
  return <AuthPanel mode="login" initialError={initialError} />;
}
