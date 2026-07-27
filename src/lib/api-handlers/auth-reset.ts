import { NextRequest, NextResponse } from "next/server";
import {
  normalizeEmail,
  passwordResetRedirectUrl,
} from "@/lib/password-reset";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE =
  "If an account exists, a reset link is on its way.";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const email = await readEmail(request);

  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    console.error("[auth/reset-password] Supabase is not configured", {
      requestId,
    });
    return NextResponse.json(
      { error: "Password reset is temporarily unavailable." },
      { status: 503 },
    );
  }

  const redirectTo = passwordResetRedirectUrl(request.url);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Do not log the address or expose provider details to the browser. The
    // generic response prevents account enumeration while Vercel logs retain
    // enough detail to diagnose SMTP, rate-limit, and template failures.
    console.error("[auth/reset-password] Supabase rejected reset request", {
      requestId,
      code: error.code,
      status: error.status,
      message: error.message,
    });
  } else {
    console.info("[auth/reset-password] Reset request accepted", { requestId });
  }

  return NextResponse.json(
    { message: GENERIC_MESSAGE, requestId },
    {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function readEmail(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (!body || typeof body !== "object" || !("email" in body)) return null;
  return normalizeEmail((body as { email?: unknown }).email);
}
