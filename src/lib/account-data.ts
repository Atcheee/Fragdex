import type { CollectionEntry } from "./fragrance-collection";
import type { FavoriteFragrance } from "./favorite-fragrances";
import type { RecentFragrance } from "./recent-fragrances";
import type { DailyConnectionsProgress, SyncedStoreState } from "./store";
import type { ScentleProgress } from "./scentle-types";
import type { TasteEvent } from "./taste-passport";
import type { GameModeId, GameRecord } from "./types";

export const ACCOUNT_SCHEMA_VERSION = 1;
export const ACCOUNT_DATA_CHANGED_EVENT = "tot-account-data-change";
export const ACCOUNT_MAX = {
  history: 100,
  tasteEvents: 2_000,
  favorites: 100,
  collection: 500,
  recent: 9,
  localProgress: 120,
} as const;

export interface LocalProgressEntry {
  key: string;
  value: unknown;
}

export interface AccountSnapshot {
  schemaVersion: typeof ACCOUNT_SCHEMA_VERSION;
  revision?: number;
  history: GameRecord[];
  best: Partial<Record<GameModeId, number>>;
  tasteAnonymousId: string;
  tasteEvents: TasteEvent[];
  favorites: FavoriteFragrance[];
  collection: CollectionEntry[];
  recent: RecentFragrance[];
  dailyConnections?: DailyConnectionsProgress;
  scentleProgress?: ScentleProgress;
  localProgress: LocalProgressEntry[];
}

export function emptyAccountSnapshot(): AccountSnapshot {
  return {
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    history: [],
    best: {},
    tasteAnonymousId: "",
    tasteEvents: [],
    favorites: [],
    collection: [],
    recent: [],
    localProgress: [],
  };
}

export function normalizeAccountSnapshot(value: unknown): AccountSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<AccountSnapshot>;
  if (
    input.schemaVersion !== ACCOUNT_SCHEMA_VERSION ||
    !Array.isArray(input.history) ||
    !Array.isArray(input.tasteEvents) ||
    !Array.isArray(input.favorites) ||
    !Array.isArray(input.collection) ||
    !Array.isArray(input.recent) ||
    !Array.isArray(input.localProgress) ||
    !input.best ||
    typeof input.best !== "object"
  ) {
    return null;
  }
  const hasStringId = (item: unknown): item is { id: string } =>
    Boolean(
      item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string",
    );
  const hasProgressKey = (item: unknown): item is LocalProgressEntry =>
    Boolean(
      item &&
        typeof item === "object" &&
        typeof (item as { key?: unknown }).key === "string",
    );
  return {
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    revision:
      typeof input.revision === "number" ? Math.max(0, input.revision) : undefined,
    history: input.history.filter(hasStringId).slice(0, ACCOUNT_MAX.history) as GameRecord[],
    best: input.best,
    tasteAnonymousId:
      typeof input.tasteAnonymousId === "string"
        ? input.tasteAnonymousId.slice(0, 200)
        : "",
    tasteEvents: input.tasteEvents
      .filter(hasStringId)
      .slice(0, ACCOUNT_MAX.tasteEvents) as TasteEvent[],
    favorites: input.favorites
      .filter(hasStringId)
      .slice(0, ACCOUNT_MAX.favorites) as FavoriteFragrance[],
    collection: input.collection
      .filter(hasStringId)
      .slice(0, ACCOUNT_MAX.collection) as CollectionEntry[],
    recent: input.recent
      .filter(hasStringId)
      .slice(0, ACCOUNT_MAX.recent) as RecentFragrance[],
    dailyConnections: input.dailyConnections,
    scentleProgress: input.scentleProgress,
    localProgress: input.localProgress
      .filter(hasProgressKey)
      .filter((entry) => entry.key.length <= 300)
      .slice(0, ACCOUNT_MAX.localProgress),
  };
}

export function hasAccountProgress(snapshot: AccountSnapshot): boolean {
  return Boolean(
    snapshot.history.length ||
      snapshot.tasteEvents.length ||
      snapshot.favorites.length ||
      snapshot.collection.length ||
      snapshot.recent.length ||
      snapshot.dailyConnections ||
      snapshot.scentleProgress ||
      snapshot.localProgress.length,
  );
}

export function mergeAccountSnapshots(
  account: AccountSnapshot,
  guest: AccountSnapshot,
): AccountSnapshot {
  return {
    ...account,
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    history: mergeById(account.history, guest.history, ACCOUNT_MAX.history),
    best: mergeBests(account.best, guest.best),
    tasteAnonymousId: account.tasteAnonymousId || guest.tasteAnonymousId,
    tasteEvents: mergeById(
      account.tasteEvents,
      guest.tasteEvents,
      ACCOUNT_MAX.tasteEvents,
    ),
    favorites: mergeById(account.favorites, guest.favorites, ACCOUNT_MAX.favorites),
    collection: mergeById(
      account.collection,
      guest.collection,
      ACCOUNT_MAX.collection,
    ),
    recent: mergeById(account.recent, guest.recent, ACCOUNT_MAX.recent),
    dailyConnections: account.dailyConnections ?? guest.dailyConnections,
    scentleProgress: account.scentleProgress ?? guest.scentleProgress,
    localProgress: mergeProgress(account.localProgress, guest.localProgress),
  };
}

export function toSyncedStoreState(snapshot: AccountSnapshot): SyncedStoreState {
  return {
    history: snapshot.history.slice(0, ACCOUNT_MAX.history),
    best: snapshot.best,
    dailyConnections: snapshot.dailyConnections,
    scentleProgress: snapshot.scentleProgress,
    tasteAnonymousId: snapshot.tasteAnonymousId,
    tasteEvents: snapshot.tasteEvents.slice(0, ACCOUNT_MAX.tasteEvents),
  };
}

export function notifyAccountDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCOUNT_DATA_CHANGED_EVENT));
  }
}

function mergeById<T extends { id: string }>(
  account: T[],
  guest: T[],
  limit: number,
): T[] {
  const result = [...account];
  const ids = new Set(account.map((item) => item.id));
  for (const item of guest) {
    if (!ids.has(item.id)) result.push(item);
  }
  return result.slice(0, limit);
}

function mergeBests(
  account: Partial<Record<GameModeId, number>>,
  guest: Partial<Record<GameModeId, number>>,
) {
  const result = { ...guest, ...account };
  for (const mode of Object.keys(guest) as GameModeId[]) {
    result[mode] = Math.max(account[mode] ?? -1, guest[mode] ?? -1);
  }
  return result;
}

function mergeProgress(
  account: LocalProgressEntry[],
  guest: LocalProgressEntry[],
): LocalProgressEntry[] {
  const accountKeys = new Set(account.map((entry) => entry.key));
  return [
    ...account,
    ...guest.filter((entry) => !accountKeys.has(entry.key)),
  ].slice(0, ACCOUNT_MAX.localProgress);
}
