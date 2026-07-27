import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowSquareOut,
  ArrowsLeftRight,
} from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import {
  getFragranceBySlug,
  getFragrancesBySlugs,
  type CatalogFragrance,
} from "@/lib/catalog";
import {
  cloneDataGeneratedAt,
  cloneDataSources,
  formatClonePrice,
  getCloneProfileBySlug,
  getCloneSlugs,
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
  const fragrance = profile.catalogSlug
    ? await getFragranceBySlug(profile.catalogSlug)
    : undefined;
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
      images: fragrance?.imageUrl ? [{ url: fragrance.imageUrl }] : undefined,
    },
  };
}

export default async function ClonePage({ params }: ClonePageProps) {
  const { slug } = await params;
  const profile = getCloneProfileBySlug(slug);
  if (!profile) notFound();

  const catalogSlugs = [
    ...new Set([
      ...(profile.catalogSlug ? [profile.catalogSlug] : []),
      ...profile.relationships.flatMap((relationship) =>
        relationship.originalCatalogSlug
          ? [relationship.originalCatalogSlug]
          : [],
      ),
    ]),
  ];
  const catalogFragrances = await getFragrancesBySlugs(catalogSlugs);
  const catalogBySlug = new Map(
    catalogFragrances.map((fragrance) => [fragrance.slug, fragrance]),
  );
  const cloneFragrance = profile.catalogSlug
    ? catalogBySlug.get(profile.catalogSlug)
    : undefined;
  const featuredRelationship = profile.relationships[0]!;
  const featuredOriginal = featuredRelationship.originalCatalogSlug
    ? catalogBySlug.get(featuredRelationship.originalCatalogSlug)
    : undefined;

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
        <div className="border-b border-border p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            Clone fragrance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {profile.name}
            {profile.house ? (
              <span className="font-normal text-muted"> by {profile.house}</span>
            ) : null}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Listed as an affordable alternative to{" "}
            {profile.relationships.length === 1
              ? featuredRelationship.originalName
              : `${featuredRelationship.originalName} and ${profile.relationships.length - 1} other original fragrance${profile.relationships.length === 2 ? "" : "s"}`}
            . Compare the bottles, prices, and source estimates below.
          </p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)]">
          <ComparisonFragrance
            role="Clone"
            name={profile.name}
            house={profile.house}
            fragrance={cloneFragrance}
            href={
              profile.catalogSlug
                ? `/fragrance/${profile.catalogSlug}`
                : undefined
            }
            eager
          />

          <div className="flex items-center justify-center border-y border-border px-4 py-4 md:border-x md:border-y-0">
            <div className="flex items-center gap-2 text-center md:flex-col">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-[#17120a]">
                <ArrowsLeftRight aria-hidden size={20} />
              </span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Inspired by
              </span>
            </div>
          </div>

          <ComparisonFragrance
            role="Original"
            name={featuredRelationship.originalName}
            house={featuredOriginal?.house}
            fragrance={featuredOriginal}
            href={
              featuredRelationship.originalCatalogSlug
                ? `/fragrance/${featuredRelationship.originalCatalogSlug}`
                : undefined
            }
          />
        </div>

        <div className="border-t border-border p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact
              label="Similarity"
              value={
                featuredRelationship.similarityPercent !== undefined
                  ? `${featuredRelationship.similarityPercent}%`
                  : "Not rated"
              }
            />
            <Fact
              label="Clone price"
              value={
                featuredRelationship.clonePrice !== undefined
                  ? formatClonePrice(featuredRelationship.clonePrice)
                  : "Not listed"
              }
            />
            <Fact
              label="Featured original"
              value={
                featuredRelationship.originalPrice !== undefined
                  ? formatClonePrice(featuredRelationship.originalPrice)
                  : "Not listed"
              }
            />
            <Fact
              label="Savings"
              value={
                featuredRelationship.savingsPercent !== undefined
                  ? `${featuredRelationship.savingsPercent}% less`
                  : "Not listed"
              }
            />
          </dl>
          {profile.relationships.length > 1 ? (
            <p className="mt-3 text-xs text-muted">
              Best similarity match shown. This clone has{" "}
              {profile.relationships.length} listed original comparisons.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="originals-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Compare originals
          </p>
          <h2
            id="originals-heading"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            What {profile.name} is inspired by
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Source lists can connect one clone with more than one original.
            Each comparison below shows its own similarity and savings estimate.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {profile.relationships.map((relationship, index) => (
            <OriginalCard
              key={relationship.id}
              relationship={relationship}
              fragrance={
                relationship.originalCatalogSlug
                  ? catalogBySlug.get(relationship.originalCatalogSlug)
                  : undefined
              }
              position={index + 1}
              total={profile.relationships.length}
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

function ComparisonFragrance({
  role,
  name,
  house,
  fragrance,
  href,
  eager = false,
}: {
  role: "Clone" | "Original";
  name: string;
  house?: string;
  fragrance?: CatalogFragrance;
  href?: string;
  eager?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="bottle-studio flex h-64 items-end justify-center px-6 pb-5 pt-7 sm:h-72">
        <FragranceBottleImage
          imageUrl={fragrance?.imageUrl}
          alt={`${name}${house ? ` by ${house}` : ""} bottle`}
          eager={eager}
          width={330}
          height={440}
          sizes="(max-width: 768px) 70vw, 34vw"
          className="max-h-56 w-auto max-w-full object-contain sm:max-h-64"
          placeholderClassName="h-36 w-auto text-stone-400 opacity-35"
          stage={false}
          preferCutout
        />
      </div>
      <div className="flex flex-1 flex-col items-center border-t border-border p-5 text-center">
        <span
          className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${
            role === "Clone"
              ? "bg-accent text-[#17120a]"
              : "border border-border bg-background text-muted"
          }`}
        >
          {role}
        </span>
        {house ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {house}
          </p>
        ) : null}
        <h2 className="mt-1 font-display text-xl font-semibold">{name}</h2>
        {href ? (
          <Link
            href={href}
            className="mt-4 inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
          >
            View fragrance profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function OriginalCard({
  relationship,
  fragrance,
  position,
  total,
}: {
  relationship: CloneRelationship;
  fragrance?: CatalogFragrance;
  position: number;
  total: number;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="bottle-studio flex min-h-52 items-end justify-center px-4 pb-5 pt-6 sm:min-h-full">
          <FragranceBottleImage
            imageUrl={fragrance?.imageUrl}
            alt={`${relationship.originalName} bottle`}
            width={210}
            height={280}
            sizes="(max-width: 640px) 55vw, 145px"
            className="max-h-44 w-auto max-w-full object-contain"
            placeholderClassName="h-28 w-auto text-stone-400 opacity-35"
            stage={false}
            preferCutout
          />
        </div>
        <div className="min-w-0 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Original fragrance {position} of {total}
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
          {fragrance?.house ? (
            <p className="mt-1 text-sm text-muted">by {fragrance.house}</p>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <Fact
              label="Similarity"
              value={
                relationship.similarityPercent !== undefined
                  ? `${relationship.similarityPercent}%`
                  : "Not rated"
              }
            />
            <Fact
              label="Savings"
              value={
                relationship.savingsPercent !== undefined
                  ? `${relationship.savingsPercent}% less`
                  : "Not listed"
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
          </dl>

          {relationship.review ? (
            <div className="mt-5 rounded-xl bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Source review
              </p>
              <p className="mt-2 leading-6 text-muted">
                {relationship.review}
              </p>
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
        </div>
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
