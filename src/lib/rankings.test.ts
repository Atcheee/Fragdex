import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoard,
  moveItem,
  removeTier,
  validateBoard,
  type RankingTemplateVersion,
} from "./rankings";

const template: RankingTemplateVersion = {
  id: "template-version-1",
  templateId: "template-1",
  version: 1,
  title: "Test",
  description: "",
  category: "Fragrance",
  visibility: "public",
  displayMode: "contain",
  items: [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "three", name: "Three" },
  ],
  tiers: [
    { id: "best", label: "Best", color: "#ff0000" },
    { id: "good", label: "Good", color: "#00ff00" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("moving an item preserves exactly one location", () => {
  let board = createBoard(template);
  board = moveItem(board, "one", { tierId: "best" });
  board = moveItem(board, "one", { tierId: "good" });

  assert.deepEqual(board.tiers[0].itemIds, []);
  assert.deepEqual(board.tiers[1].itemIds, ["one"]);
  assert.deepEqual(board.unrankedItemIds, ["two", "three"]);
  assert.deepEqual(validateBoard(board), []);
});

test("item order inside a tier is explicit and mutable", () => {
  let board = createBoard(template);
  board = moveItem(board, "one", { tierId: "best" });
  board = moveItem(board, "two", { tierId: "best" });
  board = moveItem(board, "two", { tierId: "best", index: 0 });

  assert.deepEqual(board.tiers[0].itemIds, ["two", "one"]);
  assert.deepEqual(validateBoard(board), []);
});

test("removing a tier returns its items to unranked", () => {
  let board = createBoard(template);
  board = moveItem(board, "three", { tierId: "best" });
  board = removeTier(board, "best");

  assert.deepEqual(board.tiers.map((tier) => tier.id), ["good"]);
  assert.equal(board.unrankedItemIds.includes("three"), true);
  assert.deepEqual(validateBoard(board), []);
});

test("invalid targets do not corrupt the board", () => {
  const board = createBoard(template);
  const unchanged = moveItem(board, "one", { tierId: "missing" });

  assert.equal(unchanged, board);
  assert.deepEqual(validateBoard(unchanged), []);
});
