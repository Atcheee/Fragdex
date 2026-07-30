import type { Metadata } from "next";
import { AccountDashboard } from "@/components/auth/AccountDashboard";

export const metadata: Metadata = {
  title: "Account — Scenthub",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountDashboard />;
}
