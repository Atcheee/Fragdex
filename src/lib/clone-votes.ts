export const CLONE_VOTER_STORAGE_KEY = "tot-guest-import-id";

export const ACCURACY_VOTE_OPTIONS = [
  { label: "Far off", percent: 30 },
  { label: "Loose", percent: 50 },
  { label: "Close", percent: 75 },
  { label: "Very close", percent: 90 },
  { label: "Dead ringer", percent: 98 },
] as const;

export type AccuracyVoteOption = (typeof ACCURACY_VOTE_OPTIONS)[number];

export interface CloneVoteStats {
  relationshipId: string;
  communityPercent: number | null;
  voteCount: number;
  myAccuracyPercent: number | null;
}

const VOTER_KEY_PATTERN = /^(user|guest)_[A-Za-z0-9_-]{8,128}$/;

export function isValidAccuracyPercent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}

export function isValidVoterKey(value: unknown): value is string {
  return typeof value === "string" && VOTER_KEY_PATTERN.test(value);
}

export function userVoterKey(userId: string): string {
  return `user_${userId}`;
}

export function createGuestVoterKey(): string {
  return `guest_${crypto.randomUUID()}`;
}

export function readOrCreateGuestVoterKey(): string {
  if (typeof window === "undefined") return createGuestVoterKey();
  const existing = window.localStorage.getItem(CLONE_VOTER_STORAGE_KEY);
  if (isValidVoterKey(existing) && existing.startsWith("guest_")) {
    return existing;
  }
  const next = createGuestVoterKey();
  window.localStorage.setItem(CLONE_VOTER_STORAGE_KEY, next);
  return next;
}

export function nearestAccuracyOption(
  percent: number,
): AccuracyVoteOption | undefined {
  let best: AccuracyVoteOption | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const option of ACCURACY_VOTE_OPTIONS) {
    const distance = Math.abs(option.percent - percent);
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }
  return best;
}

export function formatVoteCount(count: number): string {
  if (count <= 0) return "No votes yet";
  if (count === 1) return "1 vote";
  return `${count} votes`;
}
