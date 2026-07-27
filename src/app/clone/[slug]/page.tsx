import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowSquareOut,
  ArrowsLeftRight,
} from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleIcon } from "@/components/FragranceBottleIcon";
import {
  bestSavings,
  bestSimilarity,
  cloneDataGeneratedAt,
  cloneDataSources,
  formatClonePrice,
  getCloneProfileBySlug,
  getCloneSlugs,
  lowestClonePrice,
  type CloneRelationship,
} from "@/lib/clone-data";

interface ClonePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getCloneSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ClonePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = getCloneProfileBySlug(slug);
  if (!profile) return { title: "Clone fragrance not found" };
  const original = profile.relationships[0]?.originalName;
  const description = `${profile.name}${
    profile.house ? ` by ${profile.house}` : ""
  } is listed as an affordable alternative to ${original}. Compare similarity, price, and savings estimates.`;

  return {
    title: `${profile.name} fragrance clone — This or That`,
    description,
    alternates: { canonical: `/clone/${profile.slug}` },
    openGraph: {
      type: "article",
      title: `${profile.name}${profile.house ? ` by ${profile.house}` : ""}`,
      description,
      url: `/clone/${profile.slug}`,
    },
  };
}

export default async function ClonePage({ params }: ClonePageProps) {
  const { slug } = await params;
  const profile = getCloneProfileBySlug(slug);
  if (!profile) notFound();

  const similarity = bestSimilarity(profile);
  const savings = bestSavings(profile);
  const price = lowestClonePrice(profile);

  return (
    <article className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/clones" className="hover:text-foreground">
              Clones
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate text-foreground" aria-current="page">
            {profile.name}
          </li>
        </ol>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.5fr)]">
          <div className="bottle-studio flex min-h-72 items-center justify-center rounded-2xl px-4 py-6">
            <div className="relative grid size-48 place-items-center rounded-full border border-border bg-card/60 text-stone-400">
              <FragranceBottleIcon
                aria-hidden
                size={100}
                weight="light"
                className="opacity-60"
              />
              <ArrowsLeftRight
                aria-hidden
                size={28}
                className="absolute bottom-6 right-6 rounded-full bg-accent p-1.5 text-[#17120a]"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
              {profile.house ?? "Clone fragrance"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              {profile.name}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Affordable alternative listed for{" "}
              {profile.relationships.length}{" "}
              {profile.relationships.length === 1
                ? "original fragrance"
                : "original fragrances"}
              .
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact
                label="Best match"
                value={similarity >= 0 ? `${similarity}%` : "Not rated"}
              />
              <Fact
                label="Listed price"
                value={Number.isFinite(price) ? formatClonePrice(price) : "Not listed"}
              />
              <Fact
                label="Best savings"
                value={savings >= 0 ? `${savings}%` : "Not listed"}
              />
              <Fact
                label="Originals"
                value={String(profile.relationships.length)}
              />
            </dl>

            {profile.catalogSlug ? (
              <Link
                href={`/fragrance/${profile.catalogSlug}`}
                className="mt-5 inline-flex w-fit min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
              >
                View full fragrance profile
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="originals-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Compare alternatives
          </p>
          <h2
            id="originals-heading"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            Original {profile.relationships.length === 1 ? "fragrance" : "fragrances"}
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {profile.relationships.map((relationship) => (
            <OriginalCard
              key={relationship.id}
              relationship={relationship}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">About these estimates</h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted">
          Similarity and review text come from the listed clone sources. Prices
          are snapshots and can change by retailer, region, bottle size, and
          availability. A clone relationship describes scent inspiration, not
          product identity or brand affiliation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
          {cloneDataSources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 hover:border-accent hover:bg-card-hover"
            >
              {source.name}
              <ArrowSquareOut aria-hidden size={14} />
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Data refreshed{" "}
          <time dateTime={cloneDataGeneratedAt}>
            {new Intl.DateTimeFormat("en", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date(cloneDataGeneratedAt))}
          </time>
          .
        </p>
      </section>
    </article>
  );
}

function OriginalCard({
  relationship,
}: {
  relationship: CloneRelationship;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Original fragrance
      </p>
      {relationship.originalCatalogSlug ? (
        <Link
          href={`/fragrance/${relationship.originalCatalogSlug}`}
          className="mt-1.5 block font-display text-xl font-semibold hover:text-accent"
        >
          {relationship.originalName}
        </Link>
      ) : (
        <h3 className="mt-1.5 font-display text-xl font-semibold">
          {relationship.originalName}
        </h3>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact
          label="Similarity"
          value={
            relationship.similarityPercent !== undefined
              ? `${relationship.similarityPercent}%`
              : "Not rated"
          }
        />
        <Fact
          label="Clone price"
          value={
            relationship.clonePrice !== undefined
              ? formatClonePrice(relationship.clonePrice)
              : "Not listed"
          }
        />
        <Fact
          label="Original price"
          value={
            relationship.originalPrice !== undefined
              ? formatClonePrice(relationship.originalPrice)
              : "Not listed"
          }
        />
        <Fact
          label="Savings"
          value={
            relationship.savingsPercent !== undefined
              ? `${relationship.savingsPercent}%`
              : "Not listed"
          }
        />
      </dl>

      {relationship.review ? (
        <div className="mt-5 rounded-xl bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Source review
          </p>
          <p className="mt-2 leading-6 text-muted">{relationship.review}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {relationship.originalCatalogSlug ? (
          <Link
            href={`/fragrance/${relationship.originalCatalogSlug}`}
            className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-[#17120a]"
          >
            Original profile
          </Link>
        ) : null}
        {relationship.dealUrl ? (
          <a
            href={relationship.dealUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold hover:border-accent hover:bg-card-hover"
          >
            Source deal
            <ArrowSquareOut aria-hidden size={14} />
          </a>
        ) : null}
      </div>
    </article>
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
