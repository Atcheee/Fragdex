"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function HeaderAccount() {
  const { user, loading } = useAuth();
  if (loading) {
    return <span className="h-9 w-16 animate-pulse rounded-full bg-card-hover" />;
  }
  return user ? (
    <Link
      href="/account"
      className="flex h-9 max-w-32 items-center rounded-full border border-border bg-card px-3 text-xs font-bold hover:border-accent"
      title={user.email}
    >
      <span className="truncate">{displayName(user.email)}</span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="rounded-full border border-border bg-card px-3 py-2 text-xs font-bold hover:border-accent"
    >
      Log in
    </Link>
  );
}

function displayName(email?: string): string {
  return email?.split("@")[0] || "Account";
}
