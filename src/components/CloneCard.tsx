import Link from "next/link";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import type { CatalogFragrance } from "@/lib/catalog";
import {
  bestSavings,
  bestSimilarity,
  formatClonePrice,
  lowestClonePrice,
  type CloneProfile,
} from "@/lib/clone-data";

export function CloneCard({
  profile,
  cloneFragrance,
  originalFragrance,
}: {
  profile: CloneProfile;
  cloneFragrance?: CatalogFragrance;
  originalFragrance?: CatalogFragrance;
}) {
  const similarity = bestSimilarity(profile);
  const savings = bestSavings(profile);
  const price = lowestClonePrice(profile);
  const featuredOriginal = profile.relationships[0]!;

  return (
    <Link
      href={`/clone/${profile.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent hover:bg-card-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="bottle-studio relative grid h-40 grid-cols-[1fr_2.25rem_1fr] items-end px-3 pb-3 pt-5">
        <div className="flex h-full min-w-0 items-end justify-center">
          <FragranceBottleImage
            imageUrl={cloneFragrance?.imageUrl}
            alt={`${profile.name}${profile.house ? ` by ${profile.house}` : ""} bottle`}
            width={150}
            height={200}
            sizes="(max-width: 640px) 34vw, (max-width: 1280px) 13vw, 110px"
            className="max-h-32 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            placeholderClassName="h-20 w-auto text-stone-400 opacity-35"
            stage={false}
            preferCutout
          />
        </div>
        <span className="mb-10 grid size-9 place-items-center rounded-full border border-accent/25 bg-background/90 text-accent shadow-sm">
          <ArrowsLeftRight aria-hidden size={18} />
        </span>
        <div className="flex h-full min-w-0 items-end justify-center">
          <FragranceBottleImage
            imageUrl={originalFragrance?.imageUrl}
            alt={`${featuredOriginal.originalName} bottle`}
            width={150}
            height={200}
            sizes="(max-width: 640px) 34vw, (max-width: 1280px) 13vw, 110px"
            className="max-h-32 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            placeholderClassName="h-20 w-auto text-stone-400 opacity-35"
            stage={false}
            preferCutout
          />
        </div>
        <span className="absolute left-3 top-3 rounded-full border border-border bg-background/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-foreground">
          Clone
        </span>
        <span className="absolute right-3 top-3 rounded-full border border-border bg-background/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-muted">
          Original
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="min-w-0">
          <span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
            {profile.house ?? "Clone fragrance"}
          </span>
          <h2 className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight">
            {profile.name}
          </h2>
        </div>

        <div className="mt-3 border-l-2 border-accent/60 pl-3">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-wide text-muted">
            Inspired by
          </span>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-5">
            {featuredOriginal.originalName}
            {profile.relationships.length > 1 ? (
              <span className="font-normal text-muted">
                {" "}
                + {profile.relationships.length - 1} more
              </span>
            ) : null}
          </p>
        </div>

        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border/70 pt-4 text-center">
          <Metric
            label="Similarity"
            value={similarity >= 0 ? `${similarity}%` : "—"}
          />
          <Metric
            label="Clone price"
            value={Number.isFinite(price) ? formatClonePrice(price) : "—"}
          />
          <Metric label="Savings" value={savings >= 0 ? `${savings}%` : "—"} />
        </dl>
      </div>
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
