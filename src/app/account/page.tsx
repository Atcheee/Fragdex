import type { Metadata } from "next";
import { AccountDashboard } from "@/components/auth/AccountDashboard";

export const metadata: Metadata = { title: "Account — Fragdex" };

export default function AccountPage() {
  return <AccountDashboard />;
}
