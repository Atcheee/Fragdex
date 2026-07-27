"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  hasAccountProgress,
  normalizeAccountSnapshot,
  type AccountSnapshot,
} from "@/lib/account-data";
import {
  applyLocalAccountSnapshot,
  captureLocalAccountSnapshot,
  subscribeToLocalAccountData,
} from "@/lib/account-storage";
import { useAppStore } from "@/lib/store";
import { useAuth } from "./AuthProvider";

type SyncStatus = "guest" | "loading" | "saved" | "saving" | "offline" | "error";

interface SyncContextValue {
  status: SyncStatus;
  syncNow: () => Promise<void>;
}

interface ImportPrompt {
  remote: AccountSnapshot;
  guest: AccountSnapshot;
  guestId: string;
}

interface QueuedOperation {
  operationId: string;
  snapshot: AccountSnapshot;
}

const ACTIVE_USER_KEY = "tot-active-account-user";
const GUEST_BACKUP_KEY = "tot-guest-progress-backup";
const GUEST_ID_KEY = "tot-guest-import-id";
const QUEUE_PREFIX = "tot-sync-queue:";
const DECISION_PREFIX = "tot-guest-decision:";

const AccountSyncContext = createContext<SyncContextValue>({
  status: "guest",
  syncNow: async () => undefined,
});

export function AccountSyncProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("guest");
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<ImportPrompt | null>(null);
  const suppressChanges = useRef(false);
  const timer = useRef<number | null>(null);

  const applyWithoutSync = useCallback((snapshot: AccountSnapshot) => {
    suppressChanges.current = true;
    applyLocalAccountSnapshot(snapshot);
    window.setTimeout(() => {
      suppressChanges.current = false;
    }, 0);
  }, []);

  const flushQueue = useCallback(async (userId: string) => {
    const queue = readQueue(userId);
    if (!queue) {
      setStatus("saved");
      return true;
    }
    setStatus("saving");
    try {
      const response = await fetch("/api/account/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queue),
      });
      if (!response.ok) throw new Error("sync failed");
      window.localStorage.removeItem(`${QUEUE_PREFIX}${userId}`);
      setStatus("saved");
      return true;
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
      return false;
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!readyUserId) return;
    queueSnapshot(readyUserId, captureLocalAccountSnapshot());
    await flushQueue(readyUserId);
  }, [flushQueue, readyUserId]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    async function initialize() {
      await waitForStoreHydration();
      if (cancelled) return;
      const activeUserId = window.localStorage.getItem(ACTIVE_USER_KEY);

      if (!user) {
        if (activeUserId) restoreGuestBackup(applyWithoutSync);
        setReadyUserId(null);
        setPrompt(null);
        setStatus("guest");
        return;
      }

      setStatus("loading");
      if (activeUserId && activeUserId !== user.id) {
        restoreGuestBackup(applyWithoutSync);
      }

      if (activeUserId === user.id) {
        const flushed = await flushQueue(user.id);
        if (!flushed) {
          setReadyUserId(user.id);
          return;
        }
        const remote = await fetchRemoteSnapshot();
        if (!cancelled && remote) {
          applyWithoutSync(remote);
          setReadyUserId(user.id);
          setStatus("saved");
        }
        return;
      }

      const guest = captureLocalAccountSnapshot();
      window.localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(guest));
      const remote = await fetchRemoteSnapshot();
      if (cancelled || !remote) {
        setStatus(navigator.onLine ? "error" : "offline");
        return;
      }
      const guestId = getGuestId(guest);
      const decision = window.localStorage.getItem(
        `${DECISION_PREFIX}${user.id}:${guestId}`,
      );
      if (hasAccountProgress(guest) && !decision) {
        setPrompt({ remote, guest, guestId });
        return;
      }
      activateAccount(user.id, remote, applyWithoutSync, setReadyUserId);
      setStatus("saved");
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [applyWithoutSync, flushQueue, loading, user]);

  useEffect(() => {
    if (!readyUserId) return;
    const onChange = () => {
      if (suppressChanges.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      setStatus("saving");
      timer.current = window.setTimeout(() => {
        queueSnapshot(readyUserId, captureLocalAccountSnapshot());
        void flushQueue(readyUserId);
      }, 900);
    };
    const unsubscribe = subscribeToLocalAccountData(onChange);
    const onOnline = () => void flushQueue(readyUserId);
    window.addEventListener("online", onOnline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [flushQueue, readyUserId]);

  async function chooseImport(importGuest: boolean) {
    if (!prompt || !user) return;
    setStatus("saving");
    const decisionKey = `${DECISION_PREFIX}${user.id}:${prompt.guestId}`;
    if (importGuest) {
      try {
        const response = await fetch("/api/account/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            guestId: prompt.guestId,
            snapshot: prompt.guest,
          }),
        });
        const imported = normalizeAccountSnapshot(await response.json());
        if (!response.ok || !imported) throw new Error("import failed");
        window.localStorage.setItem(decisionKey, "imported");
        activateAccount(user.id, imported, applyWithoutSync, setReadyUserId);
        setPrompt(null);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
      return;
    }
    window.localStorage.setItem(decisionKey, "separate");
    activateAccount(
      user.id,
      prompt.remote,
      applyWithoutSync,
      setReadyUserId,
    );
    setPrompt(null);
    setStatus("saved");
  }

  return (
    <AccountSyncContext.Provider value={{ status, syncNow }}>
      {children}
      {prompt && (
        <ImportGuestDialog
          busy={status === "saving"}
          onChoice={chooseImport}
        />
      )}
    </AccountSyncContext.Provider>
  );
}

export function useAccountSync(): SyncContextValue {
  return useContext(AccountSyncContext);
}

function ImportGuestDialog({
  busy,
  onChoice,
}: {
  busy: boolean;
  onChoice: (importGuest: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-import-title"
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          Guest progress found
        </p>
        <h2 id="guest-import-title" className="mt-2 font-display text-2xl font-semibold">
          Add this device’s progress to your account?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Importing merges game history, taste signals, favorites, collection,
          and daily progress. Account data wins if the same item exists in both.
          You can also keep the two sets separate.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onChoice(true)}
            className="rounded-full bg-accent px-5 py-3 font-bold text-white disabled:opacity-50 dark:text-black"
          >
            Import guest progress
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onChoice(false)}
            className="rounded-full border border-border px-5 py-3 font-semibold hover:border-accent disabled:opacity-50"
          >
            Keep separate
          </button>
        </div>
      </section>
    </div>
  );
}

async function fetchRemoteSnapshot(): Promise<AccountSnapshot | null> {
  try {
    const response = await fetch("/api/account/data", { cache: "no-store" });
    if (!response.ok) return null;
    return normalizeAccountSnapshot(await response.json());
  } catch {
    return null;
  }
}

function activateAccount(
  userId: string,
  snapshot: AccountSnapshot,
  apply: (snapshot: AccountSnapshot) => void,
  setReady: (userId: string) => void,
) {
  apply(snapshot);
  window.localStorage.setItem(ACTIVE_USER_KEY, userId);
  setReady(userId);
}

function restoreGuestBackup(apply: (snapshot: AccountSnapshot) => void) {
  const raw = window.localStorage.getItem(GUEST_BACKUP_KEY);
  const backup = raw ? normalizeAccountSnapshot(safeParse(raw)) : null;
  if (backup) apply(backup);
  window.localStorage.removeItem(ACTIVE_USER_KEY);
}

function getGuestId(snapshot: AccountSnapshot): string {
  if (snapshot.tasteAnonymousId) return snapshot.tasteAnonymousId;
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = `guest_${crypto.randomUUID()}`;
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

function queueSnapshot(userId: string, snapshot: AccountSnapshot) {
  const operation: QueuedOperation = {
    operationId: crypto.randomUUID(),
    snapshot,
  };
  window.localStorage.setItem(
    `${QUEUE_PREFIX}${userId}`,
    JSON.stringify(operation),
  );
}

function readQueue(userId: string): QueuedOperation | null {
  const raw = window.localStorage.getItem(`${QUEUE_PREFIX}${userId}`);
  const value = raw ? safeParse(raw) : null;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<QueuedOperation>;
  const snapshot = normalizeAccountSnapshot(candidate.snapshot);
  return typeof candidate.operationId === "string" && snapshot
    ? { operationId: candidate.operationId, snapshot }
    : null;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function waitForStoreHydration(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
