import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CloneCard } from "@/components/CloneCard";
import {
  filterCloneProfiles,
  getCloneProfiles,
  type CloneSort,
} from "@/lib/clone-data";
import { getFragrancesBySlugs } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Fragrance clones and affordable alternatives — This or That",
  description:
    "Browse fragrance clones, similarity estimates, listed prices, savings, and their designer or niche originals.",
  alternates: { canonical: "/clones" },
};

const PAGE_SIZE = 24;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClonesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = getParam(params, "q").trim();
  const sort = validSort(getParam(params, "sort"));
  const requestedPage = positiveInteger(getParam(params, "page"));
  const profiles = filterCloneProfiles(query, sort);
  const totalPages = Math.max(1, Math.ceil(profiles.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visibleProfiles = profiles.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const catalogSlugs = [
    ...new Set(
      visibleProfiles.flatMap((profile) => [
        ...(profile.catalogSlug ? [profile.catalogSlug] : []),
        ...profile.relationships.flatMap((relationship) =>
          relationship.originalCatalogSlug
            ? [relationship.originalCatalogSlug]
            : [],
        ),
      ]),
    ),
  ];
  const catalogFragrances = await getFragrancesBySlugs(catalogSlugs);
  const catalogBySlug = new Map(
    catalogFragrances.map((fragrance) => [fragrance.slug, fragrance]),
  );
  const relationshipCount = getCloneProfiles().reduce(
    (sum, profile) => sum + profile.relationships.length,
    0,
  );

  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Alternative scent library
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Fragrance clones
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-muted">
          Compare {relationshipCount} affordable alternatives with their
          designer and niche inspirations. Similarity, price, and savings are
          source estimates—not guarantees.
        </p>
      </section>

      <form
        action="/clones"
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(180px,0.35fr)_auto]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Search
            </span>
            <span className="relative block">
              <MagnifyingGlass
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={17}
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Clone, house, or original"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </span>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Sort by
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              <option value="similarity">Best match</option>
              <option value="savings">Biggest savings</option>
              <option value="price">Lowest price</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <button
            type="submit"
            className="mt-auto h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
          >
            Find clones
          </button>
        </div>
      </form>

      <section aria-labelledby="clone-results-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="clone-results-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              {query ? `Results for “${query}”` : "All clone fragrances"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {profiles.length} {profiles.length === 1 ? "clone" : "clones"}
            </p>
          </div>
          {query || sort !== "similarity" ? (
            <Link
              href="/clones"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
        </div>

        {visibleProfiles.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProfiles.map((profile) => (
              <CloneCard
                key={profile.slug}
                profile={profile}
                cloneFragrance={
                  profile.catalogSlug
                    ? catalogBySlug.get(profile.catalogSlug)
                    : undefined
                }
                originalFragrance={
                  profile.relationships[0]?.originalCatalogSlug
                    ? catalogBySlug.get(
                        profile.relationships[0].originalCatalogSlug,
                      )
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <h3 className="font-semibold">No clone fragrances found</h3>
            <p className="mt-1 text-sm text-muted">
              Try the original fragrance, clone name, or house.
            </p>
            <Link
              href="/clones"
              className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#17120a]"
            >
              Browse all clones
            </Link>
          </div>
        )}

        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            query={query}
            sort={sort}
          />
        ) : null}
      </section>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  query,
  sort,
}: {
  currentPage: number;
  totalPages: number;
  query: string;
  sort: CloneSort;
}) {
  return (
    <nav
      aria-label="Clone results pages"
      className="mt-8 flex items-center justify-center gap-4"
    >
      {currentPage > 1 ? (
        <Link
          href={pageHref(query, sort, currentPage - 1)}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card"
        >
          Previous
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          Previous
        </span>
      )}
      <span className="text-sm tabular-nums text-muted">
        Page <strong className="text-foreground">{currentPage}</strong> of{" "}
        {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link
          href={pageHref(query, sort, currentPage + 1)}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card"
        >
          Next
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          Next
        </span>
      )}
    </nav>
  );
}

function pageHref(query: string, sort: CloneSort, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== "similarity") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/clones?${suffix}` : "/clones";
}

function validSort(value: string): CloneSort {
  return value === "savings" || value === "price" || value === "name"
    ? value
    : "similarity";
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
