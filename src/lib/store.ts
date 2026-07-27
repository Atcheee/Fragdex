import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScentleProgress } from "./scentle-types";
import type { GameModeId, GameRecord } from "./types";
import {
  buildTasteProfile,
  createAnonymousTasteId,
  createTasteEvent,
  emptyTasteProfile,
  type TasteEvent,
  type TasteEventInput,
  type TasteProfile,
} from "./taste-passport";

export interface DailyConnectionsProgress {
  dateKey: string;
  puzzleId: string;
  tileOrder: string[];
  selectedIds: string[];
  solvedGroupIds: string[];
  mistakes: number;
  outcome: "won" | "lost" | null;
}

export interface SyncedStoreState {
  history: GameRecord[];
  best: Partial<Record<GameModeId, number>>;
  dailyConnections?: DailyConnectionsProgress;
  scentleProgress?: ScentleProgress;
  tasteAnonymousId: string;
  tasteEvents: TasteEvent[];
}

interface AppState extends SyncedStoreState {
  apiKey: string;
  history: GameRecord[];
  /** Best score percentage (0–100) per quiz mode, or raw count for naming modes */
  best: Partial<Record<GameModeId, number>>;
  dailyConnections?: DailyConnectionsProgress;
  scentleProgress?: ScentleProgress;
  /** Stable device identity. Can later be linked to an authenticated account. */
  tasteAnonymousId: string;
  /** Immutable source events, kept separately so scoring can be rebuilt. */
  tasteEvents: TasteEvent[];
  /** Derived projection from tasteEvents. Never treated as source data. */
  tasteProfile: TasteProfile;
  setApiKey: (key: string) => void;
  addRecord: (record: GameRecord) => void;
  setDailyConnections: (progress: DailyConnectionsProgress) => void;
  setScentleProgress: (progress: ScentleProgress) => void;
  recordTasteEvent: (event: TasteEventInput) => void;
  rebuildTasteProfile: () => void;
  clearTastePassport: () => void;
  clearHistory: () => void;
  replaceSyncedState: (state: SyncedStoreState) => void;
}

const NAMING_MODES: GameModeId[] = ["name-by-house", "name-by-note"];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: "",
      history: [],
      best: {},
      tasteAnonymousId: "",
      tasteEvents: [],
      tasteProfile: emptyTasteProfile(),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setDailyConnections: (dailyConnections) => set({ dailyConnections }),
      setScentleProgress: (scentleProgress) => set({ scentleProgress }),
      recordTasteEvent: (input) =>
        set((state) => {
          const tasteAnonymousId =
            state.tasteAnonymousId || createAnonymousTasteId();
          const event = createTasteEvent(tasteAnonymousId, input);
          const tasteEvents = [event, ...state.tasteEvents].slice(0, 2_000);
          return {
            tasteAnonymousId,
            tasteEvents,
            tasteProfile: buildTasteProfile(tasteEvents),
          };
        }),
      rebuildTasteProfile: () =>
        set((state) => ({
          tasteProfile: buildTasteProfile(state.tasteEvents),
        })),
      clearTastePassport: () =>
        set({
          tasteAnonymousId: "",
          tasteEvents: [],
          tasteProfile: emptyTasteProfile(),
        }),
      addRecord: (record) =>
        set((state) => {
          const isNaming = NAMING_MODES.includes(record.mode);
          const value = isNaming
            ? record.score
            : record.total > 0
              ? Math.round((record.score / record.total) * 100)
              : 0;
          const prev = state.best[record.mode] ?? -1;
          return {
            history: [record, ...state.history].slice(0, 100),
            best:
              value > prev
                ? { ...state.best, [record.mode]: value }
                : state.best,
          };
        }),
      clearHistory: () => set({ history: [], best: {} }),
      replaceSyncedState: (state) =>
        set({
          ...state,
          tasteProfile: buildTasteProfile(state.tasteEvents),
        }),
    }),
    {
      name: "this-or-that-storage",
      version: 3,
      migrate: (persisted) => {
        const state = persisted as Partial<AppState>;
        const tasteEvents = state.tasteEvents ?? [];
        const history = (state.history ?? []).map((record) => ({
          ...record,
          id:
            record.id ??
            `game_${record.playedAt}_${record.mode}_${Math.random().toString(36).slice(2, 9)}`,
        }));
        return {
          ...state,
          history,
          tasteAnonymousId: state.tasteAnonymousId ?? "",
          tasteEvents,
          tasteProfile: buildTasteProfile(tasteEvents),
        } as AppState;
      },
    },
  ),
);
