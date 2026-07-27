"use client";

import Link from "next/link";
import { useEffect, useState, useEffectEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ACCURACY_VOTE_OPTIONS,
  formatVoteCount,
  nearestAccuracyOption,
  type CloneVoteStats,
} from "@/lib/clone-votes";

type LoadState = "loading" | "ready" | "unavailable" | "error";

export function CloneAccuracyVote({
  relationshipId,
}: {
  relationshipId: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [stats, setStats] = useState<CloneVoteStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadVotes = useEffectEvent(async () => {
    if (authLoading) return;
    setState("loading");
    setMessage(null);
    try {
      const params = new URLSearchParams({ relationshipId });
      const response = await fetch(`/api/clone/votes?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 503) {
        setStats(null);
        setState("unavailable");
        return;
      }
      if (!response.ok) {
        setState("error");
        setMessage("Could not load community votes.");
        return;
      }
      const data = (await response.json()) as { votes?: CloneVoteStats[] };
      const vote = data.votes?.[0] ?? null;
      setStats(
        vote ?? {
          relationshipId,
          communityPercent: null,
          voteCount: 0,
          myAccuracyPercent: null,
        },
      );
      setState("ready");
    } catch {
      setState("error");
      setMessage("Could not load community votes.");
    }
  });

  useEffect(() => {
    void loadVotes();
  }, [relationshipId, user?.id, authLoading]);

  async function castVote(accuracyPercent: number) {
    if (!user || saving || state === "unavailable") return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/clone/votes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId,
          accuracyPercent,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        vote?: CloneVoteStats;
        error?: string;
      };
      if (!response.ok || !data.vote) {
        setMessage(data.error ?? "Could not save your vote.");
        return;
      }
      setStats(data.vote);
      setState("ready");
      setMessage("Thanks — your accuracy vote is in.");
      window.dispatchEvent(
        new CustomEvent("clone-accuracy-vote", {
          detail: data.vote,
        }),
      );
    } catch {
      setMessage("Could not save your vote.");
    } finally {
      setSaving(false);
    }
  }

  const selected = stats?.myAccuracyPercent;
  const selectedOption =
    selected !== null && selected !== undefined
      ? nearestAccuracyOption(selected)
      : undefined;
  const canVote = Boolean(user) && state !== "unavailable" && !authLoading;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">How accurate is this clone?</p>
          <p className="mt-1 text-xs text-muted">
            {state === "unavailable"
              ? "Community voting needs Supabase to be configured."
              : authLoading
                ? "Checking sign-in…"
                : !user
                  ? "Sign in to cast your accuracy vote."
                  : selected !== null && selected !== undefined
                    ? `Your vote: ${selected}%${selectedOption ? ` (${selectedOption.label})` : ""}. Tap again to change it.`
                    : "Signed-in users can vote once per comparison."}
          </p>
        </div>
        {state === "ready" && stats ? (
          <p className="text-xs text-muted">
            Community average:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {stats.communityPercent !== null
                ? `${stats.communityPercent}%`
                : "—"}
            </span>{" "}
            · {formatVoteCount(stats.voteCount)}
          </p>
        ) : null}
      </div>

      {!authLoading && !user ? (
        <div className="mt-3">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-[#17120a] transition-transform hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Sign in to vote
          </Link>
        </div>
      ) : (
        <div
          className={`mt-3 flex flex-wrap gap-2 ${canVote ? "" : "opacity-60"}`}
          role="group"
          aria-label="Clone accuracy rating"
        >
          {ACCURACY_VOTE_OPTIONS.map((option) => {
            const isActive = selected === option.percent;
            return (
              <button
                key={option.percent}
                type="button"
                disabled={!canVote || saving}
                aria-pressed={isActive}
                onClick={() => castVote(option.percent)}
                className={`inline-flex min-h-10 flex-col items-start justify-center rounded-full border px-3.5 py-1.5 text-left transition-[background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
                  isActive
                    ? "border-accent bg-accent text-[#17120a]"
                    : "border-border bg-card hover:border-accent hover:bg-card-hover"
                }`}
              >
                <span className="text-xs font-semibold leading-none">
                  {option.label}
                </span>
                <span
                  className={`mt-1 text-[0.65rem] tabular-nums leading-none ${
                    isActive ? "text-[#17120a]/80" : "text-muted"
                  }`}
                >
                  {option.percent}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {message ? (
        <p className="mt-3 text-xs text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CloneCommunityFact({
  relationshipId,
}: {
  relationshipId: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [label, setLabel] = useState("…");
  const [hint, setHint] = useState("Loading");

  const applyStats = useEffectEvent((vote: CloneVoteStats | undefined) => {
    if (!vote || vote.communityPercent === null) {
      setLabel("—");
      setHint("No votes yet");
      return;
    }
    setLabel(`${vote.communityPercent}%`);
    setHint(formatVoteCount(vote.voteCount));
  });

  const load = useEffectEvent(async () => {
    if (authLoading) return;
    try {
      const params = new URLSearchParams({ relationshipId });
      const response = await fetch(`/api/clone/votes?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        setLabel("—");
        setHint("Unavailable");
        return;
      }
      const data = (await response.json()) as { votes?: CloneVoteStats[] };
      applyStats(data.votes?.[0]);
    } catch {
      setLabel("—");
      setHint("Unavailable");
    }
  });

  useEffect(() => {
    void load();
  }, [relationshipId, user?.id, authLoading]);

  useEffect(() => {
    function onVote(event: Event) {
      const detail = (event as CustomEvent<CloneVoteStats>).detail;
      if (!detail || detail.relationshipId !== relationshipId) return;
      applyStats(detail);
    }
    window.addEventListener("clone-accuracy-vote", onVote);
    return () => window.removeEventListener("clone-accuracy-vote", onVote);
  }, [relationshipId]);

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
        Community
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{label}</dd>
      <p className="mt-1 text-[0.65rem] text-muted">{hint}</p>
    </div>
  );
}
