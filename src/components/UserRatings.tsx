"use client";

import Link from "next/link";
import { useEffect, useState, useEffectEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  LONGEVITY_OPTIONS,
  OCCASION_COLORS,
  SENTIMENT_COLORS,
  SILLAGE_OPTIONS,
  longevityOption,
  sillageOption,
  type FragranceVoteStats,
  type OccasionId,
  type SentimentId,
} from "@/lib/fragrance-votes";
import {
  deriveSentimentBuckets,
  deriveWearBuckets,
  formatCount,
  type SentimentBucket,
  type WearBucket,
} from "@/lib/visuals/wear-profile";

const SEASON_IDS: WearBucket["id"][] = ["winter", "spring", "summer", "fall"];
const TIME_IDS: WearBucket["id"][] = ["day", "night"];

interface UserRatingsProps {
  fragranceId: string;
  rating: number;
  votes?: number;
  accords: string[];
  wearShares?: Partial<Record<WearBucket["id"], number>>;
  longevity?: string;
  sillage?: string;
}

type LoadState = "loading" | "ready" | "unavailable" | "error";

export function UserRatings({
  fragranceId,
  rating,
  votes = 0,
  accords,
  wearShares,
  longevity,
  sillage,
}: UserRatingsProps) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [community, setCommunity] = useState<FragranceVoteStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadVotes = useEffectEvent(async () => {
    if (authLoading) return;
    setState("loading");
    try {
      const params = new URLSearchParams({ fragranceId });
      const response = await fetch(`/api/fragrance/votes?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 503) {
        setCommunity(null);
        setState("unavailable");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const data = (await response.json()) as { vote?: FragranceVoteStats };
      setCommunity(data.vote ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  });

  useEffect(() => {
    void loadVotes();
  }, [fragranceId, user?.id, authLoading]);

  async function saveVote(payload: Record<string, unknown>) {
    if (saving || state === "unavailable") return;
    if (!user) {
      setMessage("Sign in to vote on ratings, occasions, longevity, and sillage.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/fragrance/votes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragranceId, ...payload }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        vote?: FragranceVoteStats;
        error?: string;
      };
      if (response.status === 401) {
        setMessage("Sign in to vote on ratings, occasions, longevity, and sillage.");
        return;
      }
      if (!response.ok || !data.vote) {
        setMessage(data.error ?? "Could not save your vote.");
        return;
      }
      setCommunity(data.vote);
      setState("ready");
      setMessage("Thanks — your vote is saved.");
    } catch {
      setMessage("Could not save your vote.");
    } finally {
      setSaving(false);
    }
  }

  function voteSentiment(id: SentimentId) {
    const current = community?.my?.sentiment;
    void saveVote({ sentiment: current === id ? null : id });
  }

  function toggleOccasion(id: OccasionId) {
    const current = new Set(community?.my?.occasions ?? []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    void saveVote({
      occasions: ["winter", "spring", "summer", "fall", "day", "night"].filter(
        (item) => current.has(item as OccasionId),
      ),
    });
  }

  function voteLongevity(level: number) {
    const current = community?.my?.longevityLevel;
    void saveVote({ longevityLevel: current === level ? null : level });
  }

  function voteSillage(level: number) {
    const current = community?.my?.sillageLevel;
    void saveVote({ sillageLevel: current === level ? null : level });
  }

  const catalogSentiments = deriveSentimentBuckets(rating, votes);
  const catalogWear = deriveWearBuckets(accords, votes, wearShares);
  const hasStoredWear = hasWearShares(wearShares);

  const useCommunitySentiment = (community?.sentimentVoteCount ?? 0) > 0;
  const useCommunityWear = (community?.occasionVoterCount ?? 0) > 0;
  const useCommunityScore = (community?.sentimentVoteCount ?? 0) > 0;
  const useCommunityLongevity = (community?.longevityVoteCount ?? 0) > 0;
  const useCommunitySillage = (community?.sillageVoteCount ?? 0) > 0;

  const sentiments: SentimentBucket[] = useCommunitySentiment
    ? (Object.keys(SENTIMENT_COLORS) as SentimentId[]).map((id) => {
        const count = community!.sentiment[id];
        const total = community!.sentimentVoteCount || 1;
        return {
          id,
          label: id,
          count,
          share: count / total,
          color: SENTIMENT_COLORS[id],
        };
      })
    : catalogSentiments;

  const wear: WearBucket[] = useCommunityWear
    ? (Object.keys(OCCASION_COLORS) as OccasionId[]).map((id) => {
        const count = community!.occasions[id];
        const max = Math.max(
          ...Object.values(community!.occasions),
          1,
        );
        return {
          id,
          label: id,
          count,
          share: count / max,
          color: OCCASION_COLORS[id],
        };
      })
    : catalogWear;

  const seasons = wear.filter((bucket) => SEASON_IDS.includes(bucket.id));
  const times = wear.filter((bucket) => TIME_IDS.includes(bucket.id));
  const maxSentiment = Math.max(...sentiments.map((s) => s.share), 0.01);
  const maxWear = Math.max(...wear.map((w) => w.share), 0.01);

  const displayRating = useCommunityScore
    ? (community!.communityScore ?? 0)
    : rating;
  const displayVotes = useCommunityScore
    ? community!.sentimentVoteCount
    : votes;
  const hasRating = displayRating > 0 || useCommunitySentiment;
  const hasWearData =
    useCommunityWear ||
    accords.length > 0 ||
    votes > 0 ||
    hasWearShares(wearShares);

  const catalogLongevity = longevity ? scoreLongevity(longevity) : null;
  const catalogSillage = sillage ? scoreSillage(sillage) : null;

  const longevityLevel = useCommunityLongevity
    ? Math.round(community!.longevityAvg ?? 0)
    : (catalogLongevity?.level ?? null);
  const sillageLevel = useCommunitySillage
    ? Math.round(community!.sillageAvg ?? 0)
    : (catalogSillage?.level ?? null);

  const longevityMeta =
    longevityLevel != null
      ? longevityOption(longevityLevel) ?? {
          level: longevityLevel,
          label: longevity ?? "Longevity",
          hint: catalogLongevity?.hint ?? "",
        }
      : null;
  const sillageMeta =
    sillageLevel != null
      ? sillageOption(sillageLevel) ?? {
          level: sillageLevel,
          label: sillage ?? "Sillage",
          hint: catalogSillage?.hint ?? "",
        }
      : null;

  const ratingPercent = Math.min(100, Math.max(0, (displayRating / 5) * 100));
  const votingAvailable = state !== "unavailable" && !authLoading;
  const canAttemptVote = votingAvailable && !saving;
  const mySentiment = community?.my?.sentiment ?? null;
  const myOccasions = new Set(community?.my?.occasions ?? []);
  const myLongevity = community?.my?.longevityLevel ?? null;
  const mySillage = community?.my?.sillageLevel ?? null;

  const sourceNote = (() => {
    if (state === "unavailable") {
      return "Community voting needs Supabase to be configured.";
    }
    if (useCommunitySentiment || useCommunityWear) {
      return "Bars reflect signed-in community votes. Catalog estimates are used until the first votes arrive.";
    }
    return hasStoredWear
      ? "Sentiment bars are estimated from rating and votes; wear bars use catalog occasion rankings when available. Sign in to cast the first community votes."
      : "Sentiment and wear bars are estimated from catalog rating, votes, and accords. Sign in to cast the first community votes.";
  })();

  return (
    <section aria-label="User ratings" className="space-y-4">
      <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        User ratings
      </h2>

      {!user && !authLoading ? (
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>{" "}
          to vote on rating, when to wear, longevity, and sillage.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <header className="mb-5 flex items-center justify-center gap-2">
            <HeartIcon className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Rating
            </h3>
          </header>
          {hasRating || votingAvailable ? (
            <div
              className="grid grid-cols-5 gap-2 sm:gap-3"
              role="radiogroup"
              aria-label="Your rating"
            >
              {sentiments.map((bucket) => (
                <MetricColumn
                  key={bucket.id}
                  label={bucket.label}
                  count={bucket.count}
                  color={bucket.color}
                  fillRatio={bucket.share / maxSentiment}
                  icon={<SentimentEmoji id={bucket.id} />}
                  selected={mySentiment === bucket.id}
                  disabled={!canAttemptVote}
                  onClick={() => voteSentiment(bucket.id)}
                  voteHint="Select one rating"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No rating data available.</p>
          )}
          <p className="mt-3 text-center text-[11px] text-muted">
            Select one. Your pick updates the community score.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <header className="mb-5 flex items-center justify-center gap-2">
            <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              When to wear
            </h3>
          </header>
          {hasWearData || votingAvailable ? (
            <div className="space-y-5">
              <WearRow
                title="Seasons"
                buckets={seasons}
                maxShare={maxWear}
                selected={myOccasions}
                disabled={!canAttemptVote}
                onToggle={toggleOccasion}
              />
              <WearRow
                title="Day / night"
                buckets={times}
                maxShare={maxWear}
                selected={myOccasions}
                disabled={!canAttemptVote}
                onToggle={toggleOccasion}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">No occasion data available.</p>
          )}
          <p className="mt-3 text-center text-[11px] text-muted">
            Select as many as you like.
          </p>
        </div>
      </div>

      {hasRating || longevity || sillage || votingAvailable ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {hasRating || useCommunityScore || votingAvailable ? (
            <div className="relative border-b border-border px-5 py-6 sm:px-7">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.55]"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 90% at 12% 40%, rgba(45, 212, 191, 0.16), transparent 55%), radial-gradient(ellipse 50% 70% at 88% 20%, rgba(251, 191, 36, 0.08), transparent 50%)",
                }}
                aria-hidden
              />
              <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8">
                <div className="flex flex-col items-center gap-3 sm:items-start">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Community score
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-semibold tabular-nums leading-none tracking-tight text-teal-700 dark:text-teal-400">
                      {displayRating > 0 ? displayRating.toFixed(2) : "—"}
                    </span>
                    <span className="mb-1 text-sm text-muted">/ 5</span>
                  </div>
                  <StarRow rating={displayRating} />
                  {displayVotes > 0 ? (
                    <p className="text-sm text-muted">
                      Based on{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {new Intl.NumberFormat("en").format(displayVotes)}
                      </span>{" "}
                      votes
                      {useCommunityScore ? " from this community" : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      {votingAvailable
                        ? "Be the first to rate this fragrance."
                        : "Vote count unavailable"}
                    </p>
                  )}
                </div>

                <div className="flex w-full max-w-sm flex-col justify-center gap-3 sm:max-w-xs">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Score strength</span>
                    <span className="tabular-nums text-foreground">
                      {ratingPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-border/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 via-teal-400 to-amber-300"
                      style={{ width: `${Math.max(6, ratingPercent)}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted opacity-90">
                    {sourceNote}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {longevityMeta || sillageMeta || votingAvailable ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:gap-5 sm:p-6">
              <PerformanceMeter
                title="Longevity"
                value={longevityMeta?.label ?? "Not rated yet"}
                level={longevityMeta?.level ?? 0}
                max={5}
                hint={
                  longevityMeta?.hint ??
                  "Tap a segment to vote how long it lasts."
                }
                accent="#2dd4bf"
                icon={<HourglassIcon className="h-4 w-4" />}
                options={LONGEVITY_OPTIONS}
                myLevel={myLongevity}
                disabled={!canAttemptVote}
                onVote={voteLongevity}
              />
              <PerformanceMeter
                title="Sillage"
                value={sillageMeta?.label ?? "Not rated yet"}
                level={sillageMeta?.level ?? 0}
                max={5}
                hint={
                  sillageMeta?.hint ??
                  "Tap a segment to vote how far the scent projects."
                }
                accent="#fbbf24"
                icon={<WaveIcon className="h-4 w-4" />}
                options={SILLAGE_OPTIONS}
                myLevel={mySillage}
                disabled={!canAttemptVote}
                onVote={voteSillage}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-center text-xs text-muted" role="status">
          {message}{" "}
          {!user ? (
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function WearRow({
  title,
  buckets,
  maxShare,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  buckets: WearBucket[];
  maxShare: number;
  selected: Set<OccasionId>;
  disabled: boolean;
  onToggle: (id: OccasionId) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/80">
        {title}
      </p>
      <div
        className={
          buckets.length <= 2
            ? "mx-auto grid max-w-[11rem] grid-cols-2 gap-3"
            : "grid grid-cols-4 gap-2 sm:gap-3"
        }
        role="group"
        aria-label={title}
      >
        {buckets.map((bucket) => (
          <MetricColumn
            key={bucket.id}
            label={bucket.label}
            count={bucket.count}
            color={bucket.color}
            fillRatio={bucket.share / maxShare}
            icon={<WearIcon id={bucket.id} color={bucket.color} />}
            selected={selected.has(bucket.id)}
            disabled={disabled}
            onClick={() => onToggle(bucket.id)}
            voteHint="Toggle occasion"
            multi
          />
        ))}
      </div>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(2)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, rating - index));
        return <StarKey key={index} fill={fill} />;
      })}
    </div>
  );
}

function StarKey({ fill }: { fill: number }) {
  const pct = `${Math.round(fill * 100)}%`;
  return (
    <span className="relative inline-block h-4 w-4" aria-hidden>
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-4 w-4 text-border" fill="currentColor">
        <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: pct }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="currentColor">
          <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" />
        </svg>
      </span>
    </span>
  );
}

function PerformanceMeter({
  title,
  value,
  level,
  max,
  hint,
  accent,
  icon,
  options,
  myLevel,
  disabled,
  onVote,
}: {
  title: string;
  value: string;
  level: number;
  max: number;
  hint: string;
  accent: string;
  icon: ReactNode;
  options: readonly { level: number; label: string; hint: string }[];
  myLevel: number | null;
  disabled: boolean;
  onVote: (level: number) => void;
}) {
  return (
    <dl className="rounded-xl border border-border/80 bg-background/40 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            <span style={{ color: accent }}>{icon}</span>
            {title}
          </dt>
          <dd className="mt-2 text-base font-semibold leading-snug text-foreground">
            {value}
          </dd>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums"
          style={{
            color: accent,
            backgroundColor: `${accent}22`,
          }}
        >
          {level > 0 ? `${level}/${max}` : `—/${max}`}
        </span>
      </div>
      <div className="mt-4 flex gap-1.5" role="radiogroup" aria-label={`Your ${title.toLowerCase()} vote`}>
        {Array.from({ length: max }, (_, index) => {
          const voteLevel = index + 1;
          const active = index < level;
          const isMine = myLevel === voteLevel;
          const option = options.find((item) => item.level === voteLevel);
          return (
            <button
              key={voteLevel}
              type="button"
              disabled={disabled}
              aria-checked={isMine}
              role="radio"
              aria-label={option ? `${option.label} (${voteLevel} of ${max})` : `${voteLevel} of ${max}`}
              title={option?.label}
              onClick={() => onVote(voteLevel)}
              className="h-2.5 flex-1 rounded-full transition-[box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed"
              style={{
                backgroundColor: active
                  ? accent
                  : "color-mix(in oklab, var(--border) 80%, transparent)",
                opacity: active
                  ? 0.35 + ((index + 1) / max) * 0.65
                  : 0.55,
                boxShadow: isMine ? `0 0 0 2px ${accent}` : undefined,
              }}
            />
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        {hint}
        {myLevel ? ` Your vote: ${myLevel}/5.` : ""}
      </p>
    </dl>
  );
}

function hasWearShares(
  wearShares?: Partial<Record<WearBucket["id"], number>>,
): boolean {
  return Boolean(wearShares && Object.values(wearShares).some((v) => (v ?? 0) > 0));
}

function scoreLongevity(raw: string): { level: number; hint: string } {
  const value = raw.toLowerCase();
  if (/eternal|12\+|very long/.test(value)) {
    return { level: 5, hint: "Stays on skin well into the next day." };
  }
  if (/long lasting|8\+|very long lasting/.test(value)) {
    return { level: 4, hint: "Strong all-day wear for most people." };
  }
  if (/above average|6\+/.test(value)) {
    return { level: 3, hint: "Solid wear through a full workday." };
  }
  if (/average|moderate|3 hour/.test(value)) {
    return { level: 2, hint: "Expect a few hours before fading." };
  }
  return { level: 1, hint: "Light presence — reapply if you want it to last." };
}

function scoreSillage(raw: string): { level: number; hint: string } {
  const value = raw.toLowerCase();
  if (/monster|enormous/.test(value)) {
    return { level: 5, hint: "Fills a room — easy to overspray." };
  }
  if (/strong/.test(value)) {
    return { level: 4, hint: "Leaves a clear trail behind you." };
  }
  if (/good/.test(value)) {
    return { level: 3, hint: "Noticeable within arm's reach." };
  }
  if (/moderate/.test(value)) {
    return { level: 2, hint: "Present up close, quieter at distance." };
  }
  return { level: 1, hint: "Stays close to the skin." };
}

function MetricColumn({
  label,
  count,
  color,
  fillRatio,
  icon,
  selected = false,
  disabled = true,
  onClick,
  voteHint,
  multi = false,
}: {
  label: string;
  count: number;
  color: string;
  fillRatio: number;
  icon: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  voteHint?: string;
  multi?: boolean;
}) {
  const content = (
    <>
      <div className="flex h-6 items-center justify-center">{icon}</div>
      <span className="text-[11px] lowercase text-muted">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(8, fillRatio * 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>
        {formatCount(count)}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1.5">{content}</div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}${voteHint ? ` — ${voteHint}` : ""}`}
      title={voteHint}
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 transition-[background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
        selected
          ? "bg-background shadow-[inset_0_0_0_1.5px_var(--accent)]"
          : "hover:bg-background/60"
      }`}
      aria-checked={selected}
      role={multi ? "checkbox" : "radio"}
    >
      {content}
    </button>
  );
}

function SentimentEmoji({ id }: { id: SentimentBucket["id"] }) {
  const map: Record<SentimentBucket["id"], string> = {
    love: "😍",
    like: "🙂",
    ok: "😐",
    dislike: "🙁",
    hate: "😠",
  };
  return (
    <span className="text-xl leading-none" aria-hidden>
      {map[id]}
    </span>
  );
}

function WearIcon({
  id,
  color,
}: {
  id: WearBucket["id"];
  color: string;
}) {
  const common = "h-5 w-5";
  switch (id) {
    case "winter":
      return <SnowflakeIcon className={common} color={color} />;
    case "spring":
      return <LeafIcon className={common} color={color} />;
    case "summer":
      return <UmbrellaIcon className={common} color={color} />;
    case "fall":
      return <MapleIcon className={common} color={color} />;
    case "day":
      return <SunIcon className={common} color={color} />;
    case "night":
      return <MoonIcon className={common} color={color} />;
  }
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21s-6.7-4.35-9.33-7.4C.7 11.3 1.1 7.9 3.6 6.3c1.9-1.2 4.3-.7 5.7 1.1L12 10l2.7-2.6c1.4-1.8 3.8-2.3 5.7-1.1 2.5 1.6 2.9 5 1 7.3C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SnowflakeIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v18M5 7l14 10M19 7 5 17M4 12h16" />
    </svg>
  );
}

function LeafIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M17 4c-5 1-9 5-10 10-1 4 1 7 4 8 5-1 9-5 10-10 1-4-1-7-4-8z" />
      <path
        d="M8 16c2-2 5-5 8-8"
        stroke="#0f172a"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function UmbrellaIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 13a8 8 0 0 1 16 0H4z" fill={color} stroke="none" />
      <path d="M12 13v6a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MapleIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M12 3l2.2 3.2L18 5l-1 3.5L21 11l-3.5.8L19 16l-4-1.2L12 19l-3-4.2L5 16l1.5-4.2L3 11l4-2.5L6 5l3.8 1.2L12 3z" />
      <path d="M12 19v2" stroke="#0f172a" strokeWidth="1.4" />
    </svg>
  );
}

function SunIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.5" fill={color} stroke="none" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </svg>
  );
}

function MoonIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M16 3a8.5 8.5 0 1 0 5 14.5A7 7 0 1 1 16 3z" />
      <circle cx="18.5" cy="7" r="0.8" fill="#f8fafc" />
      <circle cx="20.2" cy="10.2" r="0.55" fill="#f8fafc" />
    </svg>
  );
}

function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 3h12M6 21h12M8 3v3a4 4 0 0 0 2.4 3.7L12 11l1.6-1.3A4 4 0 0 0 16 6V3M8 21v-3a4 4 0 0 1 2.4-3.7L12 13l1.6 1.3A4 4 0 0 1 16 18v3" />
    </svg>
  );
}

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </svg>
  );
}
