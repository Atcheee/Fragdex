import Link from "next/link";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import {
  bestSavings,
  bestSimilarity,
  formatClonePrice,
  lowestClonePrice,
  type CloneProfile,
} from "@/lib/clone-data";

export function CloneCard({ profile }: { profile: CloneProfile }) {
  const similarity = bestSimilarity(profile);
  const savings = bestSavings(profile);
  const price = lowestClonePrice(profile);
  const originals = profile.relationships.map(
    (relationship) => relationship.originalName,
  );

  return (
    <Link
      href={`/clone/${profile.slug}`}
      className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent hover:bg-card-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
            {profile.house ?? "Clone fragrance"}
          </span>
          <h2 className="mt-1.5 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight">
            {profile.name}
          </h2>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <ArrowsLeftRight aria-hidden size={18} />
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">
        Alternative to {originals[0]}
        {originals.length > 1 ? ` and ${originals.length - 1} more` : ""}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-4 text-center">
        <Metric
          label="Match"
          value={similarity >= 0 ? `${similarity}%` : "—"}
        />
        <Metric
          label="Price"
          value={Number.isFinite(price) ? formatClonePrice(price) : "—"}
        />
        <Metric label="Less" value={savings >= 0 ? `${savings}%` : "—"} />
      </dl>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
