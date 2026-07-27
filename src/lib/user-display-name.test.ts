import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_NAME_MAX_LENGTH,
  getUserDisplayName,
  normalizeDisplayName,
} from "./user-display-name";

test("normalizes surrounding and repeated whitespace", () => {
  assert.equal(normalizeDisplayName("  Erik   Olsen  "), "Erik Olsen");
});

test("uses saved display name before email fallback", () => {
  assert.equal(
    getUserDisplayName({
      email: "erik@example.com",
      user_metadata: { display_name: "  Scent Explorer " },
    }),
    "Scent Explorer",
  );
});

test("falls back to email name when saved name is empty", () => {
  assert.equal(
    getUserDisplayName({
      email: "erik@example.com",
      user_metadata: { display_name: "   " },
    }),
    "erik",
  );
  assert.equal(getUserDisplayName(null), "Account");
  assert.equal(DISPLAY_NAME_MAX_LENGTH, 40);
});
