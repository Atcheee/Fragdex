"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Provider } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const SOCIAL_PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "azure", label: "Microsoft" },
  { id: "discord", label: "Discord" },
  { id: "facebook", label: "Facebook" },
];

export function AuthPanel({
  mode,
  initialError = "",
}: {
  mode: AuthMode;
  initialError?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  if (!supabase) {
    return (
      <AuthCard title="Login setup pending">
        <p className="text-sm leading-relaxed text-muted">
          The site still works fully as a guest. Account login will appear after
          the Supabase environment variables are configured.
        </p>
      </AuthCard>
    );
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setBusy("credentials");
    setError("");
    setMessage("");
    if (mode === "login") {
      const { error: authError } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) setError(authError.message);
      else window.location.assign("/account");
    } else if (mode === "signup") {
      const { error: authError } = await supabase!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl("/account") },
      });
      if (authError) setError(authError.message);
      else setMessage("Check your email to verify your account, then sign in.");
    } else if (mode === "forgot") {
      const { error: authError } = await supabase!.auth.resetPasswordForEmail(
        email,
        { redirectTo: callbackUrl("/reset-password") },
      );
      if (authError) setError(authError.message);
      else setMessage("If an account exists, a reset link is on its way.");
    } else {
      const { error: authError } = await supabase!.auth.updateUser({ password });
      if (authError) setError(authError.message);
      else {
        setMessage("Password updated. Taking you to your account…");
        window.setTimeout(() => window.location.assign("/account"), 700);
      }
    }
    setBusy("");
  }

  async function sendOtp() {
    setBusy("otp");
    setError("");
    setMessage("");
    const { error: authError } = await supabase!.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl("/account"),
      },
    });
    if (authError) setError(authError.message);
    else {
      setOtpSent(true);
      setMessage("Check your email for a one-time sign-in link or code.");
    }
    setBusy("");
  }

  async function verifyOtp() {
    setBusy("verify-otp");
    setError("");
    const { error: authError } = await supabase!.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "email",
    });
    if (authError) {
      setError(authError.message);
      setBusy("");
    } else {
      window.location.assign("/account");
    }
  }

  async function socialLogin(provider: Provider) {
    setBusy(provider);
    setError("");
    const { error: authError } = await supabase!.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl("/account"),
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });
    if (authError) {
      setError(authError.message);
      setBusy("");
    }
  }

  const title = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[mode];

  return (
    <AuthCard title={title}>
      <form onSubmit={submitCredentials} className="space-y-4">
        {mode !== "reset" && (
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
        )}
        {mode !== "forgot" && (
          <Field
            label={mode === "reset" ? "New password" : "Password"}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
          />
        )}
        <button
          type="submit"
          disabled={Boolean(busy)}
          className="w-full rounded-full bg-accent px-5 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:text-black"
        >
          {busy === "credentials"
            ? "Working…"
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Update password"}
        </button>
      </form>

      {mode === "login" && (
        <>
          <button
            type="button"
            onClick={sendOtp}
            disabled={!email || Boolean(busy)}
            className="mt-3 w-full rounded-full border border-border bg-background px-5 py-3 font-semibold hover:border-accent disabled:opacity-50"
          >
            {busy === "otp" ? "Sending…" : "Email me a one-time login"}
          </button>
          {otpSent && (
            <div className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="email-otp">
                One-time email code
              </label>
              <input
                id="email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="Enter email code"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={!otpCode.trim() || Boolean(busy)}
                onClick={verifyOtp}
                className="rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-50 dark:text-black"
              >
                {busy === "verify-otp" ? "Checking…" : "Verify"}
              </button>
            </div>
          )}
          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SOCIAL_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => socialLogin(provider.id)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:border-accent disabled:opacity-50 last:col-span-2"
              >
                {busy === provider.id ? "Opening…" : provider.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl bg-success-soft p-3 text-sm text-success" role="status">
          {message}
        </p>
      )}
      <AuthLinks mode={mode} />
    </AuthCard>
  );
}

function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
        Save your fragrance journey
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {title}
      </h1>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  label: string;
  type: "email" | "password";
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        required
        type={type}
        value={value}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 font-normal outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
      {mode === "login" ? (
        <>
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create account
          </Link>
          <Link href="/forgot-password" className="text-muted hover:text-foreground">
            Forgot password?
          </Link>
        </>
      ) : (
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Back to login
        </Link>
      )}
      <Link href="/" className="text-muted hover:text-foreground">
        Continue as guest
      </Link>
    </div>
  );
}

function callbackUrl(next: string): string {
  return `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
}
