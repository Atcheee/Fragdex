"use client";

import Link from "next/link";
import { useState } from "react";
import { clearLocalAccountData } from "@/lib/account-storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAccountSync } from "./AccountSyncProvider";
import { useAuth } from "./AuthProvider";

export function AccountDashboard() {
  const { user, loading, configured } = useAuth();
  const { status, syncNow } = useAccountSync();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  if (loading) {
    return <p className="text-center text-muted">Loading your account…</p>;
  }
  if (!configured || !user) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl font-semibold">You’re browsing as a guest</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your progress stays on this device. Log in to sync it between devices,
          export it, and recover it after clearing your browser.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 font-bold text-white dark:text-black"
        >
          Log in or create account
        </Link>
      </section>
    );
  }

  const providers = [
    ...new Set(
      (user.identities ?? []).map((identity) =>
        identity.provider === "azure" ? "Microsoft" : title(identity.provider),
      ),
    ),
  ];

  async function signOut() {
    setBusy("signout");
    await getSupabaseBrowserClient()?.auth.signOut();
    window.location.assign("/");
  }

  async function clearData() {
    if (!window.confirm("Clear all synced progress and saved fragrance data?")) return;
    setBusy("clear");
    const response = await fetch("/api/account/data", { method: "DELETE" });
    if (response.ok) {
      clearLocalAccountData();
      setMessage("Your account progress was cleared.");
    } else {
      setMessage("Could not clear your data. Please try again.");
    }
    setBusy("");
  }

  async function deleteAccount() {
    const confirmation = window.prompt(
      "This permanently deletes your account and synced data. Type DELETE to continue.",
    );
    if (confirmation !== "DELETE") return;
    const hasPasswordIdentity = user!.identities?.some(
      (identity) => identity.provider === "email",
    );
    if (hasPasswordIdentity) {
      const password = window.prompt("Enter your current password to confirm.");
      if (!password || !user!.email) return;
      const { error } =
        (await getSupabaseBrowserClient()?.auth.signInWithPassword({
          email: user!.email,
          password,
        })) ?? { error: new Error("Authentication unavailable") };
      if (error) {
        setMessage("Password confirmation failed. Your account was not deleted.");
        return;
      }
    }
    setBusy("delete");
    const response = await fetch("/api/account", { method: "DELETE" });
    if (response.ok) {
      clearLocalAccountData();
      await getSupabaseBrowserClient()?.auth.signOut();
      window.location.assign("/");
    } else {
      setMessage("Could not delete your account. Please try again.");
      setBusy("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          Account
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Your saved fragrance journey
        </h1>
      </header>

      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Signed in as</p>
            <p className="mt-1 font-semibold">{user.email ?? "Social account"}</p>
            <p className="mt-2 text-xs text-muted">
              Connected with {providers.join(", ") || "email"} ·{" "}
              {user.email_confirmed_at ? "email verified" : "verification pending"}
            </p>
          </div>
          <SyncBadge status={status} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void syncNow()}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Sync now
          </button>
          <Link
            href="/api/account/export"
            prefetch={false}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Export my data
          </Link>
          <Link
            href="/forgot-password"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Reset password
          </Link>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void signOut()}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent disabled:opacity-50"
          >
            Log out
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-danger/40 bg-card p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold">Data controls</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Clearing keeps the login but removes synced progress. Deleting removes
          the account and all associated data permanently.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void clearData()}
            className="rounded-full border border-danger px-4 py-2 text-sm font-bold text-danger disabled:opacity-50"
          >
            Clear saved data
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void deleteAccount()}
            className="rounded-full bg-danger px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Delete account
          </button>
        </div>
      </section>

      {message && (
        <p role="status" className="rounded-xl bg-card p-4 text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}

function SyncBadge({ status }: { status: string }) {
  const label =
    {
      guest: "Guest mode",
      loading: "Loading…",
      saving: "Saving…",
      saved: "Synced",
      offline: "Saved locally · offline",
      error: "Sync needs retry",
    }[status] ?? status;
  return (
    <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
      {label}
    </span>
  );
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
