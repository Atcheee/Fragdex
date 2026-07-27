export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

export function passwordResetRedirectUrl(requestUrl: string): string {
  const callback = new URL("/api/auth/callback", requestUrl);
  callback.searchParams.set("next", "/reset-password");
  return callback.toString();
}
