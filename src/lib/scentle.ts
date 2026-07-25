import "server-only";

import { getFragranceById, getScentleDailyPool } from "@/lib/catalog";
import { hashSeed, utcDateKey } from "@/lib/daily";
import {
  SCENTLE_MAX_GUESSES,
  type ScentleFragranceSummary,
  type ScentleGuessFeedback,
} from "@/lib/scentle-types";
import { scoreFragranceSimilarity } from "@/lib/fragrance-similarity";
import type { Fragrance } from "@/lib/types";

function summary(fragrance: Fragrance): ScentleFragranceSummary {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    ...(fragrance.imageUrl ? { imageUrl: fragrance.imageUrl } : {}),
  };
}

export function getDailyScentleAnswer(date = new Date()): Fragrance {
  const pool = getScentleDailyPool();
  if (pool.length === 0) {
    throw new Error("No fragrances are eligible for Scentle.");
  }
  const seed = hashSeed(`scentle:${utcDateKey(date)}`);
  return pool[seed % pool.length]!;
}

export function getScentleAnswerSummary(
  date = new Date(),
): ScentleFragranceSummary {
  return summary(getDailyScentleAnswer(date));
}

export function scoreScentleGuess(
  guessId: string,
  date = new Date(),
): ScentleGuessFeedback | null {
  const guess = getFragranceById(guessId);
  if (!guess) return null;

  const answer = getDailyScentleAnswer(date);
  const isCorrect = guess.id === answer.id;
  const similarity = scoreFragranceSimilarity(answer, guess);

  return {
    guess: summary(guess),
    overallScore: similarity.overallScore,
    noteSimilarity: similarity.noteSimilarity,
    sharedNotes: similarity.sharedNotes,
    accordSimilarity: similarity.accordSimilarity,
    sharedAccords: similarity.sharedAccords,
    yearDistance: similarity.yearDistance,
    yearDirection:
      guess.year <= 0 || answer.year <= 0
        ? "unknown"
        : guess.year === answer.year
          ? "exact"
          : guess.year < answer.year
            ? "newer"
            : "older",
    sameHouse: similarity.sameHouse,
    ratingDistance: similarity.ratingDistance,
    popularitySimilarity: similarity.popularitySimilarity,
    isCorrect,
  };
}

export { SCENTLE_MAX_GUESSES };
