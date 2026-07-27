"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResultsSummary } from "@/components/ResultsSummary";
import { ScoreBar } from "@/components/ScoreBar";
import { animateCorrect, animateRevealOptions, gsap } from "@/lib/animations";
import {
  generateCloneMatchRounds,
  type CloneMatchEntry,
} from "@/lib/engines/clone-match";
import type { GameModeMeta } from "@/lib/types";
import {
  AnswerReveal,
  continueLabel,
  shortDescription,
} from "./AnswerReveal";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

interface CloneMatchGameProps {
  meta: GameModeMeta;
  entries: readonly CloneMatchEntry[];
  rounds: number;
  onPlayAgain: () => void;
}

export function CloneMatchGame({
  meta,
  entries,
  rounds,
  onPlayAgain,
}: CloneMatchGameProps) {
  const gameRounds = useMemo(
    () => generateCloneMatchRounds(entries, rounds),
    [entries, rounds],
  );
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealTimeline = useRef<ReturnType<typeof gsap.timeline> | null>(null);

  useEffect(
    () => () => {
      revealTimeline.current?.kill();
    },
    [],
  );

  const current = gameRounds[index];

  function handlePick(optionIndex: number) {
    if (picked !== null || !current) return;

    setPicked(optionIndex);
    const correct = optionIndex === current.answerIndex;
    if (correct) {
      setScore((value) => value + 1);
      setStreak((value) => value + 1);
      animateCorrect(optionRefs.current[optionIndex]);
      return;
    }

    setStreak(0);
    revealTimeline.current?.kill();
    revealTimeline.current =
      animateRevealOptions(
        optionRefs.current[optionIndex],
        optionRefs.current[current.answerIndex],
      ) ?? null;
  }

  function continueGame() {
    if (picked === null) return;
    if (index + 1 >= gameRounds.length) {
      setIsNewBest(
        saveRecord({ mode: meta.id, score, total: gameRounds.length }),
      );
      setDone(true);
      return;
    }

    setIndex((value) => value + 1);
    setPicked(null);
  }

  if (done) {
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={`${score} / ${gameRounds.length}`}
        subText={
          score === gameRounds.length
            ? "Perfect game!"
            : `You matched ${Math.round((score / gameRounds.length) * 100)}% correctly.`
        }
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      >
        <Link
          href="/clones"
          className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
        >
          Browse clone library
        </Link>
      </ResultsSummary>
    );
  }

  if (!current) return null;

  const revealed = picked !== null;
  const wasCorrect = picked === current.answerIndex;
  const isLast = index + 1 >= gameRounds.length;
  const correctOption = current.options[current.answerIndex]!;
  const relationship = current.relationship;
  const review = relationship.review
    ? shortDescription(relationship.review, 260)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <ScoreBar
        round={index}
        totalRounds={gameRounds.length}
        score={score}
        streak={streak}
      />
      <h2 className="text-center text-xl font-semibold">
        Which fragrance is its clone?
      </h2>

      <RoundStage roundKey={index} className="space-y-6">
        <section
          data-animate="item"
          className="rounded-2xl border-2 border-border bg-card p-6 text-center sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Original fragrance
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {relationship.originalName}
          </h3>
          <p className="mt-3 text-sm text-muted">
            Pick the listed affordable alternative.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.options.map((option, optionIndex) => {
            let styles = "border-border bg-card hover:border-accent";
            if (revealed) {
              if (optionIndex === current.answerIndex) {
                styles = "border-success bg-success-soft text-success";
              } else if (optionIndex === picked) {
                styles = "border-danger bg-danger-soft text-danger";
              } else {
                styles = "border-border bg-card opacity-50";
              }
            }

            return (
              <button
                key={`${index}-${option.slug}`}
                ref={(node) => {
                  optionRefs.current[optionIndex] = node;
                }}
                type="button"
                data-animate="item"
                onClick={() => handlePick(optionIndex)}
                disabled={revealed}
                className={`gsap-surface min-h-24 rounded-xl border-2 px-4 py-4 text-left transition-[border-color,background-color,opacity,color,box-shadow] duration-200 ${styles} ${
                  !revealed
                    ? "cursor-pointer hover:shadow-md"
                    : "cursor-default"
                }`}
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {option.house ?? "Clone fragrance"}
                </span>
                <span className="mt-1 block font-display text-lg font-semibold leading-snug">
                  {option.name}
                </span>
              </button>
            );
          })}
        </div>
      </RoundStage>

      {revealed ? (
        <AnswerReveal
          correct={wasCorrect}
          status={
            wasCorrect ? (
              "Correct!"
            ) : (
              <>
                The match was {correctOption.name}
                {correctOption.house ? ` by ${correctOption.house}` : ""}.
              </>
            )
          }
          continueLabel={continueLabel(isLast)}
          onContinue={continueGame}
        >
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                {relationship.cloneHouse ?? "Clone fragrance"}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {relationship.cloneName}
              </p>
              <p className="mt-2 text-sm text-muted">
                Listed alternative to {relationship.originalName}.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact
                label="Similarity"
                value={formatPercent(relationship.similarityPercent)}
              />
              <Fact
                label="Clone price"
                value={formatPrice(relationship.clonePrice)}
              />
              <Fact
                label="Original price"
                value={formatPrice(relationship.originalPrice)}
              />
              <Fact
                label="Savings"
                value={formatPercent(relationship.savingsPercent)}
              />
            </dl>

            {review ? (
              <blockquote className="rounded-xl border border-border bg-background px-4 py-3 text-center text-sm leading-relaxed text-muted">
                “{review}”
              </blockquote>
            ) : null}

            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/clone/${relationship.cloneSlug}`}
                className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-[#17120a]"
              >
                Clone details
              </Link>
              {relationship.originalCatalogSlug ? (
                <Link
                  href={`/fragrance/${relationship.originalCatalogSlug}`}
                  className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-accent hover:bg-card-hover"
                >
                  Original profile
                </Link>
              ) : null}
            </div>
          </div>
        </AnswerReveal>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? "Not listed" : `${value}%`;
}

function formatPrice(value: number | undefined): string {
  if (value === undefined) return "Not listed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
