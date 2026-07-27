export const DISPLAY_NAME_MAX_LENGTH = 40;

type DisplayNameUser = {
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getUserDisplayName(user?: DisplayNameUser | null): string {
  const savedName = user?.user_metadata?.display_name;
  if (typeof savedName === "string") {
    const normalized = normalizeDisplayName(savedName);
    if (normalized) return normalized;
  }

  return user?.email?.split("@")[0] || "Account";
}
