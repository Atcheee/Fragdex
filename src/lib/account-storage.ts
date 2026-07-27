"use client";

import {
  ACCOUNT_DATA_CHANGED_EVENT,
  ACCOUNT_MAX,
  ACCOUNT_SCHEMA_VERSION,
  emptyAccountSnapshot,
  type AccountSnapshot,
  type LocalProgressEntry,
} from "./account-data";
import {
  getFavoriteFragrances,
  replaceFavoriteFragrances,
} from "./favorite-fragrances";
import { getCollection, replaceCollection } from "./fragrance-collection";
import {
  getRecentFragrances,
  replaceRecentFragrances,
} from "./recent-fragrances";
import { useAppStore } from "./store";

const PROGRESS_PREFIXES = [
  "fragrance-bingo:",
  "fragrance-games:odd-one-out:",
] as const;

export function captureLocalAccountSnapshot(): AccountSnapshot {
  if (typeof window === "undefined") return emptyAccountSnapshot();
  const state = useAppStore.getState();
  return {
    schemaVersion: ACCOUNT_SCHEMA_VERSION,
    history: state.history.slice(0, ACCOUNT_MAX.history),
    best: state.best,
    tasteAnonymousId: state.tasteAnonymousId,
    tasteEvents: state.tasteEvents.slice(0, ACCOUNT_MAX.tasteEvents),
    favorites: getFavoriteFragrances(),
    collection: getCollection(),
    recent: getRecentFragrances(),
    dailyConnections: state.dailyConnections,
    scentleProgress: state.scentleProgress,
    localProgress: capturePrefixedStorage(),
  };
}

export function applyLocalAccountSnapshot(snapshot: AccountSnapshot): void {
  useAppStore.getState().replaceSyncedState({
    history: snapshot.history,
    best: snapshot.best,
    tasteAnonymousId: snapshot.tasteAnonymousId,
    tasteEvents: snapshot.tasteEvents,
    dailyConnections: snapshot.dailyConnections,
    scentleProgress: snapshot.scentleProgress,
  });
  replaceFavoriteFragrances(snapshot.favorites);
  replaceCollection(snapshot.collection);
  replaceRecentFragrances(snapshot.recent);
  replacePrefixedStorage(snapshot.localProgress);
}

export function clearLocalAccountData(): void {
  applyLocalAccountSnapshot(emptyAccountSnapshot());
}

export function subscribeToLocalAccountData(listener: () => void): () => void {
  const unsubscribeStore = useAppStore.subscribe(listener);
  window.addEventListener(ACCOUNT_DATA_CHANGED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    unsubscribeStore();
    window.removeEventListener(ACCOUNT_DATA_CHANGED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function capturePrefixedStorage(): LocalProgressEntry[] {
  const entries: LocalProgressEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }
    try {
      entries.push({
        key,
        value: JSON.parse(window.localStorage.getItem(key) ?? "null"),
      });
    } catch {
      // Ignore malformed legacy values.
    }
  }
  return entries.slice(0, ACCOUNT_MAX.localProgress);
}

function replacePrefixedStorage(entries: LocalProgressEntry[]): void {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
  entries.slice(0, ACCOUNT_MAX.localProgress).forEach(({ key, value }) => {
    if (PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  });
}
