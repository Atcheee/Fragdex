import type { Metadata } from "next";
import { AccountDashboard } from "@/components/auth/AccountDashboard";

export const metadata: Metadata = { title: "Account — Scent Games" };

export default function AccountPage() {
  return <AccountDashboard />;
}
