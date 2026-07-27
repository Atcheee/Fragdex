import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidFragranceId,
  isValidPerformanceLevel,
  isValidSentimentId,
  parseOccasions,
  roundCommunityScore,
} from "./fragrance-votes";

test("validates sentiment ids", () => {
  assert.equal(isValidSentimentId("love"), true);
  assert.equal(isValidSentimentId("meh"), false);
});

test("validates performance levels", () => {
  assert.equal(isValidPerformanceLevel(1), true);
  assert.equal(isValidPerformanceLevel(5), true);
  assert.equal(isValidPerformanceLevel(0), false);
  assert.equal(isValidPerformanceLevel(3.5), false);
});

test("validates fragrance ids", () => {
  assert.equal(isValidFragranceId("fragella-123"), true);
  assert.equal(isValidFragranceId("scentbase-foo/bar"), false);
  assert.equal(isValidFragranceId("ab"), false);
});

test("parses and de-duplicates occasions", () => {
  assert.deepEqual(parseOccasions(["winter", "day", "winter"]), [
    "winter",
    "day",
  ]);
  assert.equal(parseOccasions(["winter", "nope"]), null);
  assert.equal(parseOccasions("winter"), null);
});

test("rounds community scores to two decimals", () => {
  assert.equal(roundCommunityScore(4.206), 4.21);
});
