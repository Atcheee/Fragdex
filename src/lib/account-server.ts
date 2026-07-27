import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  ACCOUNT_SCHEMA_VERSION,
  emptyAccountSnapshot,
  type AccountSnapshot,
  type LocalProgressEntry,
} from "./account-data";
import { getSupabaseServerClient } from "./supabase/server";

export async function requireAccount(): Promise<
  | { supabase: SupabaseClient; user: User }
  | { response: Response }
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      response: Response.json(
        { error: "Authentication is not configured." },
        { status: 503 },
      ),
    };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: Response.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  return { supabase, user };
}

export async function readAccountSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountSnapshot> {
  const [
    profile,
    history,
    best,
    taste,
    favorites,
    collection,
    daily,
    stats,
    recent,
  ] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("revision,taste_anonymous_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("game_records")
      .select("payload")
      .eq("user_id", userId)
      .order("played_at", { ascending: false }),
    supabase.from("mode_bests").select("mode,score").eq("user_id", userId),
    supabase
      .from("taste_events")
      .select("payload")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("favorite_fragrances")
      .select("payload")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("collection_entries")
      .select("payload")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase.from("daily_progress").select("kind,data_key,payload").eq("user_id", userId),
    supabase.from("mode_stats").select("data_key,payload").eq("user_id", userId),
    supabase
      .from("recent_fragrances")
      .select("payload")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
  ]);

  const firstError = [
    profile.error,
    history.error,
    best.error,
    taste.error,
    favorites.error,
    collection.error,
    daily.error,
    stats.error,
    recent.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const snapshot = emptyAccountSnapshot();
  snapshot.revision = profile.data?.revision ?? 0;
  snapshot.tasteAnonymousId = profile.data?.taste_anonymous_id ?? "";
  snapshot.history = (history.data ?? []).map((row) => row.payload);
  snapshot.best = Object.fromEntries(
    (best.data ?? []).map((row) => [row.mode, row.score]),
  );
  snapshot.tasteEvents = (taste.data ?? []).map((row) => row.payload);
  snapshot.favorites = (favorites.data ?? []).map((row) => row.payload);
  snapshot.collection = (collection.data ?? []).map((row) => row.payload);
  snapshot.recent = (recent.data ?? []).map((row) => row.payload);

  const localProgress: LocalProgressEntry[] = [];
  for (const row of daily.data ?? []) {
    if (row.kind === "connections") snapshot.dailyConnections = row.payload;
    else if (row.kind === "scentle") snapshot.scentleProgress = row.payload;
    else localProgress.push({ key: row.data_key, value: row.payload });
  }
  for (const row of stats.data ?? []) {
    localProgress.push({ key: row.data_key, value: row.payload });
  }
  snapshot.localProgress = localProgress;
  snapshot.schemaVersion = ACCOUNT_SCHEMA_VERSION;
  return snapshot;
}

export async function writeAccountSnapshot(
  supabase: SupabaseClient,
  snapshot: AccountSnapshot,
  operationId: string,
  guestId?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("replace_account_snapshot", {
    p_operation_id: operationId,
    p_snapshot: snapshot,
    p_guest_id: guestId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
