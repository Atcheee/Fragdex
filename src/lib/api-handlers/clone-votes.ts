import { NextRequest, NextResponse } from "next/server";
import { hasCloneRelationshipId } from "@/lib/clone-data";
import {
  isValidAccuracyPercent,
  userVoterKey,
  type CloneVoteStats,
} from "@/lib/clone-votes";
import { rateLimit } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

interface StatRow {
  relationship_id: string;
  community_percent: number;
  vote_count: number;
}

const VOTE_LIMIT_PER_MINUTE = 20;
const VOTE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest): Promise<Response> {
  const relationshipIds = parseRelationshipIds(request);
  if (relationshipIds.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one relationshipId." },
      { status: 400 },
    );
  }
  if (relationshipIds.length > 40) {
    return NextResponse.json(
      { error: "Too many relationship IDs." },
      { status: 400 },
    );
  }
  for (const id of relationshipIds) {
    if (!hasCloneRelationshipId(id)) {
      return NextResponse.json(
        { error: "Unknown clone relationship." },
        { status: 404 },
      );
    }
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Community voting is not configured." },
      { status: 503 },
    );
  }

  const voterKey = await resolveVoterKey();
  const [statsResult, myVotesResult] = await Promise.all([
    admin
      .from("clone_accuracy_stats")
      .select("relationship_id,community_percent,vote_count")
      .in("relationship_id", relationshipIds),
    voterKey
      ? admin
          .from("clone_accuracy_votes")
          .select("relationship_id,accuracy_percent")
          .eq("voter_key", voterKey)
          .in("relationship_id", relationshipIds)
      : Promise.resolve({
          data: [] as { relationship_id: string; accuracy_percent: number }[],
          error: null,
        }),
  ]);

  if (statsResult.error) {
    console.error("[clone/votes] Failed to load stats", statsResult.error);
    return NextResponse.json(
      { error: "Could not load community votes." },
      { status: 500 },
    );
  }
  if (myVotesResult.error) {
    console.error("[clone/votes] Failed to load my votes", myVotesResult.error);
    return NextResponse.json(
      { error: "Could not load community votes." },
      { status: 500 },
    );
  }

  const statsById = new Map(
    ((statsResult.data ?? []) as StatRow[]).map((row) => [
      row.relationship_id,
      row,
    ]),
  );
  const myById = new Map(
    (myVotesResult.data ?? []).map((row) => [
      row.relationship_id,
      row.accuracy_percent as number,
    ]),
  );

  const votes: CloneVoteStats[] = relationshipIds.map((relationshipId) => {
    const stats = statsById.get(relationshipId);
    return {
      relationshipId,
      communityPercent: stats?.community_percent ?? null,
      voteCount: stats?.vote_count ?? 0,
      myAccuracyPercent: myById.get(relationshipId) ?? null,
    };
  });

  return NextResponse.json(
    { votes },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const limited = rateLimit(
    `clone-votes:${clientIp(request)}`,
    VOTE_LIMIT_PER_MINUTE,
    VOTE_WINDOW_MS,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many votes. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid vote payload." }, { status: 400 });
  }

  const payload = body as {
    relationshipId?: unknown;
    accuracyPercent?: unknown;
  };

  const relationshipId =
    typeof payload.relationshipId === "string"
      ? payload.relationshipId.trim()
      : "";
  if (!relationshipId || !hasCloneRelationshipId(relationshipId)) {
    return NextResponse.json(
      { error: "Unknown clone relationship." },
      { status: 404 },
    );
  }

  if (!isValidAccuracyPercent(payload.accuracyPercent)) {
    return NextResponse.json(
      { error: "Accuracy must be a whole number from 0 to 100." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Community voting is not configured." },
      { status: 503 },
    );
  }

  const identity = await requireSignedInVoter();
  if ("response" in identity) return identity.response;

  const { error: upsertError } = await admin.from("clone_accuracy_votes").upsert(
    {
      relationship_id: relationshipId,
      accuracy_percent: payload.accuracyPercent,
      voter_key: identity.voterKey,
      user_id: identity.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "relationship_id,voter_key" },
  );

  if (upsertError) {
    console.error("[clone/votes] Failed to save vote", upsertError);
    return NextResponse.json(
      { error: "Could not save your vote." },
      { status: 500 },
    );
  }

  const stats = await loadSingleStats(admin, relationshipId, identity.voterKey);
  if ("response" in stats) return stats.response;

  return NextResponse.json(
    { vote: stats.vote },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function parseRelationshipIds(request: NextRequest): string[] {
  const params = request.nextUrl.searchParams;
  const single = params.get("relationshipId")?.trim();
  const many = params.get("relationshipIds")?.trim();
  const raw = [
    ...(single ? [single] : []),
    ...(many ? many.split(",") : []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(raw)];
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function resolveVoterKey(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? userVoterKey(user.id) : null;
}

async function requireSignedInVoter(): Promise<
  { voterKey: string; userId: string } | { response: Response }
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      response: NextResponse.json(
        { error: "Community voting is not configured." },
        { status: 503 },
      ),
    };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Sign in to vote on clone accuracy." },
        { status: 401 },
      ),
    };
  }
  return { voterKey: userVoterKey(user.id), userId: user.id };
}

async function loadSingleStats(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  relationshipId: string,
  voterKey: string,
): Promise<{ vote: CloneVoteStats } | { response: Response }> {
  const [statsResult, myVoteResult] = await Promise.all([
    admin
      .from("clone_accuracy_stats")
      .select("relationship_id,community_percent,vote_count")
      .eq("relationship_id", relationshipId)
      .maybeSingle(),
    admin
      .from("clone_accuracy_votes")
      .select("accuracy_percent")
      .eq("relationship_id", relationshipId)
      .eq("voter_key", voterKey)
      .maybeSingle(),
  ]);

  if (statsResult.error || myVoteResult.error) {
    console.error("[clone/votes] Failed to reload stats", {
      statsError: statsResult.error,
      myVoteError: myVoteResult.error,
    });
    return {
      response: NextResponse.json(
        { error: "Vote saved, but community totals could not be refreshed." },
        { status: 500 },
      ),
    };
  }

  const stats = statsResult.data as StatRow | null;
  return {
    vote: {
      relationshipId,
      communityPercent: stats?.community_percent ?? null,
      voteCount: stats?.vote_count ?? 0,
      myAccuracyPercent:
        (myVoteResult.data as { accuracy_percent: number } | null)
          ?.accuracy_percent ?? null,
    },
  };
}
