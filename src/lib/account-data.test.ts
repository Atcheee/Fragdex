import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_SCHEMA_VERSION,
  emptyAccountSnapshot,
  mergeAccountSnapshots,
  normalizeAccountSnapshot,
} from "./account-data";
import type { GameRecord } from "./types";

function record(id: string, score: number): GameRecord {
  return {
    id,
    mode: "higher-rating",
    score,
    total: 10,
    playedAt: "2026-07-27T10:00:00.000Z",
  };
}

test("guest import keeps account conflicts and adds unique guest records", () => {
  const account = {
    ...emptyAccountSnapshot(),
    history: [record("same", 9)],
    best: { "higher-rating": 90 },
  };
  const guest = {
    ...emptyAccountSnapshot(),
    history: [record("same", 2), record("guest-only", 8)],
    best: { "higher-rating": 80, "cost-more": 70 },
  };

  const merged = mergeAccountSnapshots(account, guest);

  assert.deepEqual(
    merged.history.map(({ id, score }) => ({ id, score })),
    [
      { id: "same", score: 9 },
      { id: "guest-only", score: 8 },
    ],
  );
  assert.equal(merged.best["higher-rating"], 90);
  assert.equal(merged.best["cost-more"], 70);
});

test("snapshot normalization rejects incompatible data and strips invalid rows", () => {
  assert.equal(normalizeAccountSnapshot({ schemaVersion: 99 }), null);

  const normalized = normalizeAccountSnapshot({
    ...emptyAccountSnapshot(),
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    history: [record("valid", 5), { score: 2 }],
    localProgress: [{ key: "fragrance-bingo:2026-07-27", value: {} }, {}],
  });

  assert.ok(normalized);
  assert.equal(normalized.history.length, 1);
  assert.equal(normalized.localProgress.length, 1);
});

test("account API key is outside the synchronized snapshot contract", () => {
  const snapshot = emptyAccountSnapshot() as unknown as Record<string, unknown>;
  assert.equal("apiKey" in snapshot, false);
});
