import assert from "node:assert/strict";
import test from "node:test";
import {
  formatVoteCount,
  isValidAccuracyPercent,
  isValidVoterKey,
  nearestAccuracyOption,
  userVoterKey,
} from "./clone-votes";

test("accepts whole-number accuracy percentages", () => {
  assert.equal(isValidAccuracyPercent(0), true);
  assert.equal(isValidAccuracyPercent(98), true);
  assert.equal(isValidAccuracyPercent(100), true);
  assert.equal(isValidAccuracyPercent(98.5), false);
  assert.equal(isValidAccuracyPercent(-1), false);
  assert.equal(isValidAccuracyPercent(101), false);
  assert.equal(isValidAccuracyPercent("90"), false);
});

test("validates voter keys", () => {
  assert.equal(
    isValidVoterKey(userVoterKey("11111111-2222-3333-4444-555555555555")),
    true,
  );
  assert.equal(
    isValidVoterKey("guest_11111111-2222-3333-4444-555555555555"),
    true,
  );
  assert.equal(isValidVoterKey("guest_short"), false);
  assert.equal(
    isValidVoterKey("anon_11111111-2222-3333-4444-555555555555"),
    false,
  );
});

test("maps a percent to the nearest labeled option", () => {
  assert.equal(nearestAccuracyOption(92)?.label, "Very close");
  assert.equal(nearestAccuracyOption(40)?.percent, 30);
});

test("formats vote counts", () => {
  assert.equal(formatVoteCount(0), "No votes yet");
  assert.equal(formatVoteCount(1), "1 vote");
  assert.equal(formatVoteCount(12), "12 votes");
});
