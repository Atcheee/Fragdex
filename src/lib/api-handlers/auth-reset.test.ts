import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEmail,
  passwordResetRedirectUrl,
} from "../password-reset";

test("normalizes valid reset email addresses", () => {
  assert.equal(normalizeEmail("  Person@Example.com "), "person@example.com");
});

test("rejects invalid reset email addresses", () => {
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("missing-domain"), null);
  assert.equal(normalizeEmail("person@example"), null);
  assert.equal(normalizeEmail(null), null);
});

test("builds the recovery callback on the request origin", () => {
  assert.equal(
    passwordResetRedirectUrl("https://fragdex.vercel.app/api/auth/reset-password"),
    "https://fragdex.vercel.app/api/auth/callback?next=%2Freset-password",
  );
});
