import { NextRequest, NextResponse } from "next/server";
import { getFragranceById } from "@/lib/catalog";
import {
  emptyFragranceVoteStats,
  emptyOccasionCounts,
  emptySentimentCounts,
  isValidFragranceId,
  isValidPerformanceLevel,
  isValidSentimentId,
  parseOccasions,
  roundCommunityScore,
  SENTIMENT_SCORE,
  type FragranceMyVotes,
  type FragranceVoteStats,
  type OccasionId,
  type SentimentId,
} from "@/lib/fragrance-votes";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

interface VoteRow {
  fragrance_id: string;
  user_id: string;
  sentiment: SentimentId | null;
  occasions: string[] | null;
  longevity_level: number | null;
  sillage_level: number | null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const fragranceId = request.nextUrl.searchParams.get("fragranceId")?.trim();
  if (!isValidFragranceId(fragranceId)) {
    return NextResponse.json(
      { error: "Provide a valid fragranceId." },
      { status: 400 },
    );
  }

  const fragrance = await getFragranceById(fragranceId);
  if (!fragrance) {
    return NextResponse.json({ error: "Unknown fragrance." }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Community voting is not configured." },
      { status: 503 },
    );
  }

  const userId = await resolveUserId();
  const [votesResult, myResult] = await Promise.all([
    admin
      .from("fragrance_community_votes")
      .select(
        "fragrance_id,user_id,sentiment,occasions,longevity_level,sillage_level",
      )
      .eq("fragrance_id", fragranceId),
    userId
      ? admin
          .from("fragrance_community_votes")
          .select(
            "fragrance_id,user_id,sentiment,occasions,longevity_level,sillage_level",
          )
          .eq("fragrance_id", fragranceId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (votesResult.error) {
    console.error("[fragrance/votes] Failed to load votes", votesResult.error);
    return NextResponse.json(
      { error: "Could not load community votes." },
      { status: 500 },
    );
  }
  if (myResult.error) {
    console.error("[fragrance/votes] Failed to load my vote", myResult.error);
    return NextResponse.json(
      { error: "Could not load community votes." },
      { status: 500 },
    );
  }

  const stats = aggregateVotes(
    fragranceId,
    (votesResult.data ?? []) as VoteRow[],
    userId ? toMyVotes((myResult.data as VoteRow | null) ?? null) : null,
  );

  return NextResponse.json(
    { vote: stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
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
    fragranceId?: unknown;
    sentiment?: unknown;
    occasions?: unknown;
    longevityLevel?: unknown;
    sillageLevel?: unknown;
  };

  if (!isValidFragranceId(payload.fragranceId)) {
    return NextResponse.json(
      { error: "Provide a valid fragranceId." },
      { status: 400 },
    );
  }
  const fragranceId = payload.fragranceId;

  const fragrance = await getFragranceById(fragranceId);
  if (!fragrance) {
    return NextResponse.json({ error: "Unknown fragrance." }, { status: 404 });
  }

  const hasSentiment = "sentiment" in payload;
  const hasOccasions = "occasions" in payload;
  const hasLongevity = "longevityLevel" in payload;
  const hasSillage = "sillageLevel" in payload;

  if (!hasSentiment && !hasOccasions && !hasLongevity && !hasSillage) {
    return NextResponse.json(
      { error: "Provide at least one vote field to update." },
      { status: 400 },
    );
  }

  if (hasSentiment && payload.sentiment !== null && !isValidSentimentId(payload.sentiment)) {
    return NextResponse.json(
      { error: "Sentiment must be love, like, ok, dislike, or hate." },
      { status: 400 },
    );
  }

  let occasions: OccasionId[] | undefined;
  if (hasOccasions) {
    const parsed = parseOccasions(payload.occasions);
    if (!parsed) {
      return NextResponse.json(
        { error: "Occasions must be a list of valid when-to-wear values." },
        { status: 400 },
      );
    }
    occasions = parsed;
  }

  if (
    hasLongevity &&
    payload.longevityLevel !== null &&
    !isValidPerformanceLevel(payload.longevityLevel)
  ) {
    return NextResponse.json(
      { error: "Longevity must be a whole number from 1 to 5." },
      { status: 400 },
    );
  }

  if (
    hasSillage &&
    payload.sillageLevel !== null &&
    !isValidPerformanceLevel(payload.sillageLevel)
  ) {
    return NextResponse.json(
      { error: "Sillage must be a whole number from 1 to 5." },
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

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const existingResult = await admin
    .from("fragrance_community_votes")
    .select(
      "fragrance_id,user_id,sentiment,occasions,longevity_level,sillage_level",
    )
    .eq("fragrance_id", fragranceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingResult.error) {
    console.error("[fragrance/votes] Failed to load existing vote", existingResult.error);
    return NextResponse.json(
      { error: "Could not save your vote." },
      { status: 500 },
    );
  }

  const existing = (existingResult.data as VoteRow | null) ?? null;
  const next = {
    fragrance_id: fragranceId,
    user_id: user.id,
    sentiment: hasSentiment
      ? ((payload.sentiment as SentimentId | null) ?? null)
      : (existing?.sentiment ?? null),
    occasions: hasOccasions
      ? occasions!
      : ((existing?.occasions as OccasionId[] | null) ?? []),
    longevity_level: hasLongevity
      ? ((payload.longevityLevel as number | null) ?? null)
      : (existing?.longevity_level ?? null),
    sillage_level: hasSillage
      ? ((payload.sillageLevel as number | null) ?? null)
      : (existing?.sillage_level ?? null),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await admin
    .from("fragrance_community_votes")
    .upsert(next, { onConflict: "fragrance_id,user_id" });

  if (upsertError) {
    console.error("[fragrance/votes] Failed to save vote", upsertError);
    return NextResponse.json(
      { error: "Could not save your vote." },
      { status: 500 },
    );
  }

  const votesResult = await admin
    .from("fragrance_community_votes")
    .select(
      "fragrance_id,user_id,sentiment,occasions,longevity_level,sillage_level",
    )
    .eq("fragrance_id", fragranceId);

  if (votesResult.error) {
    console.error("[fragrance/votes] Failed to reload votes", votesResult.error);
    return NextResponse.json(
      { error: "Vote saved, but community totals could not be refreshed." },
      { status: 500 },
    );
  }

  const stats = aggregateVotes(
    fragranceId,
    (votesResult.data ?? []) as VoteRow[],
    {
      sentiment: next.sentiment,
      occasions: next.occasions,
      longevityLevel: next.longevity_level,
      sillageLevel: next.sillage_level,
    },
  );

  return NextResponse.json(
    { vote: stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function resolveUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function toMyVotes(row: VoteRow | null): FragranceMyVotes | null {
  if (!row) {
    return {
      sentiment: null,
      occasions: [],
      longevityLevel: null,
      sillageLevel: null,
    };
  }
  return {
    sentiment: row.sentiment,
    occasions: parseOccasions(row.occasions ?? []) ?? [],
    longevityLevel: row.longevity_level,
    sillageLevel: row.sillage_level,
  };
}

function aggregateVotes(
  fragranceId: string,
  rows: VoteRow[],
  my: FragranceMyVotes | null,
): FragranceVoteStats {
  const stats = emptyFragranceVoteStats(fragranceId);
  stats.my = my;

  let sentimentTotal = 0;
  let sentimentSum = 0;
  let longevitySum = 0;
  let sillageSum = 0;

  for (const row of rows) {
    if (row.sentiment && isValidSentimentId(row.sentiment)) {
      stats.sentiment[row.sentiment] += 1;
      sentimentTotal += 1;
      sentimentSum += SENTIMENT_SCORE[row.sentiment];
    }

    const occasions = parseOccasions(row.occasions ?? []) ?? [];
    if (occasions.length > 0) {
      stats.occasionVoterCount += 1;
      for (const occasion of occasions) {
        stats.occasions[occasion] += 1;
      }
    }

    if (typeof row.longevity_level === "number") {
      longevitySum += row.longevity_level;
      stats.longevityVoteCount += 1;
    }
    if (typeof row.sillage_level === "number") {
      sillageSum += row.sillage_level;
      stats.sillageVoteCount += 1;
    }
  }

  stats.sentimentVoteCount = sentimentTotal;
  stats.communityScore =
    sentimentTotal > 0
      ? roundCommunityScore(sentimentSum / sentimentTotal)
      : null;
  stats.longevityAvg =
    stats.longevityVoteCount > 0
      ? roundCommunityScore(longevitySum / stats.longevityVoteCount)
      : null;
  stats.sillageAvg =
    stats.sillageVoteCount > 0
      ? roundCommunityScore(sillageSum / stats.sillageVoteCount)
      : null;

  // Keep empty maps explicit for clients that expect all keys.
  stats.sentiment = { ...emptySentimentCounts(), ...stats.sentiment };
  stats.occasions = { ...emptyOccasionCounts(), ...stats.occasions };

  return stats;
}
