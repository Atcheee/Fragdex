export type RankingVisibility = "public" | "unlisted" | "private";
export type ItemDisplayMode = "contain" | "cover";

export interface RankingItem {
  id: string;
  name: string;
  imageUrl?: string;
  attribution?: string;
  alt?: string;
  temporary?: boolean;
}

export interface TierDefinition {
  id: string;
  label: string;
  color: string;
}

export interface RankingTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  title: string;
  description: string;
  category: string;
  visibility: RankingVisibility;
  coverImageUrl?: string;
  displayMode: ItemDisplayMode;
  items: RankingItem[];
  tiers: TierDefinition[];
  createdAt: string;
}

export interface RankingTier extends TierDefinition {
  itemIds: string[];
}

export interface RankingBoardState {
  id: string;
  templateId: string;
  templateVersionId: string;
  templateVersion: number;
  title: string;
  description: string;
  visibility: RankingVisibility;
  items: RankingItem[];
  tiers: RankingTier[];
  unrankedItemIds: string[];
  pinnedItemIds: string[];
  background: string;
  updatedAt: string;
}

export interface ItemLocation {
  tierId: string | null;
  index?: number;
}

export const DEFAULT_TIERS: TierDefinition[] = [
  { id: "tier-s", label: "S", color: "#e76f51" },
  { id: "tier-a", label: "A", color: "#f4a261" },
  { id: "tier-b", label: "B", color: "#e9c46a" },
  { id: "tier-c", label: "C", color: "#84a98c" },
  { id: "tier-d", label: "D", color: "#76a5af" },
];

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createBoard(
  template: RankingTemplateVersion,
): RankingBoardState {
  return {
    id: createId("ranking"),
    templateId: template.templateId,
    templateVersionId: template.id,
    templateVersion: template.version,
    title: "",
    description: "",
    visibility: "private",
    items: template.items.map((item) => ({ ...item })),
    tiers: template.tiers.map((tier) => ({ ...tier, itemIds: [] })),
    unrankedItemIds: template.items.map((item) => item.id),
    pinnedItemIds: [],
    background: "graphite",
    updatedAt: new Date().toISOString(),
  };
}

export function findItemLocation(
  board: RankingBoardState,
  itemId: string,
): ItemLocation | null {
  const unrankedIndex = board.unrankedItemIds.indexOf(itemId);
  if (unrankedIndex >= 0) return { tierId: null, index: unrankedIndex };

  for (const tier of board.tiers) {
    const index = tier.itemIds.indexOf(itemId);
    if (index >= 0) return { tierId: tier.id, index };
  }
  return null;
}

export function moveItem(
  board: RankingBoardState,
  itemId: string,
  target: ItemLocation,
): RankingBoardState {
  if (!board.items.some((item) => item.id === itemId)) return board;
  if (
    target.tierId !== null &&
    !board.tiers.some((tier) => tier.id === target.tierId)
  ) {
    return board;
  }

  const current = findItemLocation(board, itemId);
  const tiers = board.tiers.map((tier) => ({
    ...tier,
    itemIds: tier.itemIds.filter((id) => id !== itemId),
  }));
  const unrankedItemIds = board.unrankedItemIds.filter((id) => id !== itemId);
  const targetItems =
    target.tierId === null
      ? unrankedItemIds
      : tiers.find((tier) => tier.id === target.tierId)!.itemIds;
  let index =
    target.index === undefined
      ? targetItems.length
      : Math.max(0, Math.min(target.index, targetItems.length));

  if (
    current &&
    current.tierId === target.tierId &&
    current.index !== undefined &&
    target.index !== undefined &&
    target.index > current.index
  ) {
    index = Math.max(0, index);
  }
  targetItems.splice(index, 0, itemId);

  return touchBoard({ ...board, tiers, unrankedItemIds });
}

export function addTier(
  board: RankingBoardState,
  tier: TierDefinition,
  index = board.tiers.length,
): RankingBoardState {
  if (board.tiers.some((entry) => entry.id === tier.id)) return board;
  const tiers = [...board.tiers];
  tiers.splice(Math.max(0, Math.min(index, tiers.length)), 0, {
    ...tier,
    itemIds: [],
  });
  return touchBoard({ ...board, tiers });
}

export function updateTier(
  board: RankingBoardState,
  tierId: string,
  patch: Partial<Pick<TierDefinition, "label" | "color">>,
): RankingBoardState {
  if (!board.tiers.some((tier) => tier.id === tierId)) return board;
  return touchBoard({
    ...board,
    tiers: board.tiers.map((tier) =>
      tier.id === tierId ? { ...tier, ...patch } : tier,
    ),
  });
}

export function reorderTier(
  board: RankingBoardState,
  tierId: string,
  direction: -1 | 1,
): RankingBoardState {
  const index = board.tiers.findIndex((tier) => tier.id === tierId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= board.tiers.length) return board;
  const tiers = [...board.tiers];
  [tiers[index], tiers[target]] = [tiers[target], tiers[index]];
  return touchBoard({ ...board, tiers });
}

export function removeTier(
  board: RankingBoardState,
  tierId: string,
): RankingBoardState {
  const tier = board.tiers.find((entry) => entry.id === tierId);
  if (!tier || board.tiers.length <= 1) return board;
  return touchBoard({
    ...board,
    tiers: board.tiers.filter((entry) => entry.id !== tierId),
    unrankedItemIds: [...board.unrankedItemIds, ...tier.itemIds],
  });
}

export function addTemporaryItem(
  board: RankingBoardState,
  item: RankingItem,
): RankingBoardState {
  if (board.items.some((entry) => entry.id === item.id)) return board;
  return touchBoard({
    ...board,
    items: [...board.items, { ...item, temporary: true }],
    unrankedItemIds: [...board.unrankedItemIds, item.id],
  });
}

export function resetBoard(board: RankingBoardState): RankingBoardState {
  return touchBoard({
    ...board,
    tiers: board.tiers.map((tier) => ({ ...tier, itemIds: [] })),
    unrankedItemIds: board.items.map((item) => item.id),
    pinnedItemIds: [],
  });
}

export function validateBoard(board: RankingBoardState): string[] {
  const errors: string[] = [];
  const knownIds = new Set(board.items.map((item) => item.id));
  const locations = [
    ...board.unrankedItemIds,
    ...board.tiers.flatMap((tier) => tier.itemIds),
  ];
  const counts = new Map<string, number>();
  for (const id of locations) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const id of knownIds) {
    const count = counts.get(id) ?? 0;
    if (count !== 1) {
      errors.push(
        count === 0
          ? `Item ${id} has no location.`
          : `Item ${id} appears ${count} times.`,
      );
    }
  }
  for (const id of counts.keys()) {
    if (!knownIds.has(id)) errors.push(`Unknown item ${id} is placed.`);
  }
  if (new Set(board.tiers.map((tier) => tier.id)).size !== board.tiers.length) {
    errors.push("Tier IDs must be unique.");
  }
  if (!board.templateVersionId) errors.push("Template version is required.");
  return errors;
}

function touchBoard(board: RankingBoardState): RankingBoardState {
  return { ...board, updatedAt: new Date().toISOString() };
}
