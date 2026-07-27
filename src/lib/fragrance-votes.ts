import type { SentimentBucket, WearBucket } from "@/lib/visuals/wear-profile";

export type SentimentId = SentimentBucket["id"];
export type OccasionId = WearBucket["id"];

export const SENTIMENT_IDS: readonly SentimentId[] = [
  "love",
  "like",
  "ok",
  "dislike",
  "hate",
] as const;

export const OCCASION_IDS: readonly OccasionId[] = [
  "winter",
  "spring",
  "summer",
  "fall",
  "day",
  "night",
] as const;

export const SENTIMENT_SCORE: Record<SentimentId, number> = {
  love: 5,
  like: 4,
  ok: 3,
  dislike: 2,
  hate: 1,
};

export const SENTIMENT_COLORS: Record<SentimentId, string> = {
  love: "#f472b6",
  like: "#fb7185",
  ok: "#fdba74",
  dislike: "#7dd3fc",
  hate: "#38bdf8",
};

export const OCCASION_COLORS: Record<OccasionId, string> = {
  winter: "#7dd3fc",
  spring: "#4ade80",
  summer: "#fb7185",
  fall: "#fb923c",
  day: "#fbbf24",
  night: "#93c5fd",
};

export const LONGEVITY_OPTIONS = [
  {
    level: 1,
    label: "Weak",
    hint: "Light presence — reapply if you want it to last.",
  },
  {
    level: 2,
    label: "Moderate",
    hint: "Expect a few hours before fading.",
  },
  {
    level: 3,
    label: "Above Average",
    hint: "Solid wear through a full workday.",
  },
  {
    level: 4,
    label: "Long Lasting",
    hint: "Strong all-day wear for most people.",
  },
  {
    level: 5,
    label: "Eternal",
    hint: "Stays on skin well into the next day.",
  },
] as const;

export const SILLAGE_OPTIONS = [
  {
    level: 1,
    label: "Intimate",
    hint: "Stays close to the skin.",
  },
  {
    level: 2,
    label: "Moderate",
    hint: "Present up close, quieter at distance.",
  },
  {
    level: 3,
    label: "Good",
    hint: "Noticeable within arm's reach.",
  },
  {
    level: 4,
    label: "Strong",
    hint: "Leaves a clear trail behind you.",
  },
  {
    level: 5,
    label: "Enormous",
    hint: "Fills a room — easy to overspray.",
  },
] as const;

export interface FragranceMyVotes {
  sentiment: SentimentId | null;
  occasions: OccasionId[];
  longevityLevel: number | null;
  sillageLevel: number | null;
}

export interface FragranceVoteStats {
  fragranceId: string;
  sentiment: Record<SentimentId, number>;
  sentimentVoteCount: number;
  communityScore: number | null;
  occasions: Record<OccasionId, number>;
  occasionVoterCount: number;
  longevityAvg: number | null;
  longevityVoteCount: number;
  sillageAvg: number | null;
  sillageVoteCount: number;
  my: FragranceMyVotes | null;
}

export function emptySentimentCounts(): Record<SentimentId, number> {
  return { love: 0, like: 0, ok: 0, dislike: 0, hate: 0 };
}

export function emptyOccasionCounts(): Record<OccasionId, number> {
  return {
    winter: 0,
    spring: 0,
    summer: 0,
    fall: 0,
    day: 0,
    night: 0,
  };
}

export function emptyFragranceVoteStats(
  fragranceId: string,
): FragranceVoteStats {
  return {
    fragranceId,
    sentiment: emptySentimentCounts(),
    sentimentVoteCount: 0,
    communityScore: null,
    occasions: emptyOccasionCounts(),
    occasionVoterCount: 0,
    longevityAvg: null,
    longevityVoteCount: 0,
    sillageAvg: null,
    sillageVoteCount: 0,
    my: null,
  };
}

export function isValidSentimentId(value: unknown): value is SentimentId {
  return typeof value === "string" && SENTIMENT_IDS.includes(value as SentimentId);
}

export function isValidOccasionId(value: unknown): value is OccasionId {
  return typeof value === "string" && OCCASION_IDS.includes(value as OccasionId);
}

export function isValidPerformanceLevel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export function isValidFragranceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 200 &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

export function parseOccasions(value: unknown): OccasionId[] | null {
  if (!Array.isArray(value)) return null;
  const unique = new Set<OccasionId>();
  for (const item of value) {
    if (!isValidOccasionId(item)) return null;
    unique.add(item);
  }
  return OCCASION_IDS.filter((id) => unique.has(id));
}

export function longevityOption(level: number) {
  return LONGEVITY_OPTIONS.find((option) => option.level === level);
}

export function sillageOption(level: number) {
  return SILLAGE_OPTIONS.find((option) => option.level === level);
}

export function roundCommunityScore(avg: number): number {
  return Math.round(avg * 100) / 100;
}
