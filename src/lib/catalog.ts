import "server-only";

import {
  all,
  get,
  iterate,
  metaValue,
  type SqlParameter,
} from "@/lib/catalog-db";
import {
  GAME_POOL_LIMIT,
  RECOMMENDATION_CANDIDATE_LIMIT,
  RELATED_CANDIDATE_LIMIT,
  SCENTLE_POOL_LIMIT,
  SEARCH_CANDIDATE_LIMIT,
} from "@/lib/catalog-limits";
import { TERM_KIND, searchKey, slugify } from "@/lib/catalog-schema";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";
import type { Fragrance, WearOccasion } from "@/lib/types";
import { allNotes } from "@/lib/types";
import { scoreFragranceSimilarity } from "@/lib/fragrance-similarity";

export { slugify };

export interface CatalogFragrance extends Fragrance {
  slug: string;
  houseSlug: string;
}

export interface CatalogSearchResult {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

export interface HouseSummary {
  slug: string;
  name: string;
  fragranceCount: number;
  averageRating: number;
  firstYear: number | null;
  latestYear: number | null;
  topAccords: Array<{ name: string; count: number }>;
}

export interface HouseCatalog extends HouseSummary {
  fragrances: CatalogFragrance[];
}

export interface CatalogSimilarity {
  score: number;
  rankScore: number;
  sharedAccords: string[];
  sharedNotes: string[];
  sameHouse: boolean;
}

interface FragranceRow {
  id: string;
  slug: string;
  name: string;
  house: string;
  house_slug: string;
  year: number;
  rating: number;
  price: number;
  votes: number;
  image_url: string | null;
  longevity: string | null;
  sillage: string | null;
  top_notes: string;
  heart_notes: string;
  base_notes: string;
  accords: string;
  description: string;
  wear: string | null;
}

interface HouseRow {
  slug: string;
  name: string;
  fragrance_count: number;
  average_rating: number;
  first_year: number | null;
  latest_year: number | null;
  top_accords: string;
}

const FRAGRANCE_COLUMNS = `
  f.id, f.slug, f.name, f.house, f.house_slug, f.year, f.rating, f.price,
  f.votes, f.image_url, f.longevity, f.sillage, f.top_notes, f.heart_notes,
  f.base_notes, f.accords, f.description, f.wear
`;

function toFragrance(row: FragranceRow): CatalogFragrance {
  return {
    id: row.id,
    name: row.name,
    house: row.house,
    year: row.year,
    rating: row.rating,
    price: row.price,
    topNotes: JSON.parse(row.top_notes) as string[],
    heartNotes: JSON.parse(row.heart_notes) as string[],
    baseNotes: JSON.parse(row.base_notes) as string[],
    accords: JSON.parse(row.accords) as string[],
    description: row.description,
    votes: row.votes,
    slug: row.slug,
    houseSlug: row.house_slug,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.longevity ? { longevity: row.longevity } : {}),
    ...(row.sillage ? { sillage: row.sillage } : {}),
    ...(row.wear
      ? { wear: JSON.parse(row.wear) as Partial<Record<WearOccasion, number>> }
      : {}),
  };
}

function toHouseSummary(row: HouseRow): HouseSummary {
  return {
    slug: row.slug,
    name: row.name,
    fragranceCount: row.fragrance_count,
    averageRating: row.average_rating,
    firstYear: row.first_year,
    latestYear: row.latest_year,
    topAccords: JSON.parse(row.top_accords) as HouseSummary["topAccords"],
  };
}

async function selectFragrances(
  sql: string,
  ...parameters: SqlParameter[]
): Promise<CatalogFragrance[]> {
  return (await all<FragranceRow>(sql, ...parameters)).map(toFragrance);
}

function toSearchResult(fragrance: CatalogFragrance): CatalogSearchResult {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    slug: fragrance.slug,
    imageUrl: fragrance.imageUrl,
  };
}

export async function getFragranceById(
  id: string,
): Promise<CatalogFragrance | undefined> {
  return (
    await selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f WHERE f.id = ?`,
      id,
    )
  )[0];
}

export async function getFragranceBySlug(
  slug: string,
): Promise<CatalogFragrance | undefined> {
  return (
    await selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f WHERE f.slug = ?`,
      slug,
    )
  )[0];
}

export async function getFragrancesByIds(
  ids: readonly string[],
): Promise<CatalogFragrance[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f WHERE f.id IN (${placeholders})`,
    ...ids,
  );
}

/**
 * The subset of `names` that a real fragrance already uses, compared on the
 * normalized key the catalog is indexed by. Returns the names as given, so
 * callers can filter their own list directly.
 */
export async function findExistingNames(
  names: readonly string[],
): Promise<Set<string>> {
  const keys = [...new Set(names.map(searchKey))].filter(Boolean);
  if (keys.length === 0) return new Set();

  const placeholders = keys.map(() => "?").join(",");
  const rows = await all<{ name_key: string }>(
    `SELECT DISTINCT name_key FROM fragrance WHERE name_key IN (${placeholders})`,
    ...keys,
  );
  const existing = new Set(rows.map((row) => row.name_key));

  return new Set(names.filter((name) => existing.has(searchKey(name))));
}

export async function getCatalogSize(): Promise<number> {
  return Number((await metaValue("fragranceCount")) ?? 0);
}

/** Rounded catalog size floored to the nearest thousand (e.g. 91630 → 91000). */
export async function getCatalogSizeRounded(): Promise<number> {
  return Math.floor((await getCatalogSize()) / 1000) * 1000;
}

/** Display label, e.g. 91630 → "91,000+". */
export async function getCatalogSizeLabel(): Promise<string> {
  return `${(await getCatalogSizeRounded()).toLocaleString("en-US")}+`;
}

export async function getHouseBySlug(
  slug: string,
): Promise<HouseCatalog | undefined> {
  const row = await get<HouseRow>("SELECT * FROM house WHERE slug = ?", slug);
  if (!row) return undefined;
  return {
    ...toHouseSummary(row),
    fragrances: await selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.house_slug = ?
       ORDER BY f.votes DESC, f.rating DESC, f.name`,
      slug,
    ),
  };
}

export async function getAllHouseSummaries(): Promise<HouseSummary[]> {
  return (await all<HouseRow>("SELECT * FROM house ORDER BY name")).map(
    toHouseSummary,
  );
}

/**
 * Substring search over "name house", ranked by how well the match lands on
 * the name versus the house, then by popularity.
 *
 * The trigram index narrows ~100k rows to a few hundred candidates; the
 * ranking itself stays in JS where the scoring rules are easy to read.
 */
export async function searchCatalog(
  searchTerm: string,
  limit = 8,
): Promise<CatalogSearchResult[]> {
  const normalized = searchKey(searchTerm);
  if (normalized.length < 2) return [];
  const terms = expandBrandSearchTerms(normalized.split(" "), searchKey);
  if (terms.length === 0) return [];
  const expandedQuery = terms.join(" ");

  const candidates = new Map<string, CatalogFragrance>();
  for (const fragrance of await findSearchCandidates(terms)) {
    candidates.set(fragrance.id, fragrance);
  }
  // An exact name match must win even when it is too obscure to survive the
  // popularity-ordered candidate cut above.
  for (const fragrance of await selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f WHERE f.name_key = ? LIMIT 20`,
    normalized,
  )) {
    candidates.set(fragrance.id, fragrance);
  }

  return [...candidates.values()]
    .map((fragrance) => {
      const name = searchKey(fragrance.name);
      const house = searchKey(fragrance.house);
      const combined = `${name} ${house}`;
      if (!terms.every((term) => combined.includes(term))) return null;

      let score = 0;
      if (name === normalized || name === expandedQuery) score += 1_000;
      else if (name.startsWith(normalized) || name.startsWith(expandedQuery))
        score += 700;
      else if (name.includes(normalized) || name.includes(expandedQuery))
        score += 450;
      if (house === normalized || house === expandedQuery) score += 500;
      else if (house.startsWith(normalized) || house.startsWith(expandedQuery))
        score += 260;
      if (combined.startsWith(normalized) || combined.startsWith(expandedQuery)) {
        score += 180;
      }
      score += Math.min(Math.log10((fragrance.votes ?? 0) + 1) * 30, 150);
      score += fragrance.rating > 0 ? fragrance.rating * 2 : 0;

      return { fragrance, score };
    })
    .filter(
      (result): result is { fragrance: CatalogFragrance; score: number } =>
        result !== null,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0) ||
        a.fragrance.name.localeCompare(b.fragrance.name),
    )
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ fragrance }) => toSearchResult(fragrance));
}

async function findSearchCandidates(
  terms: string[],
): Promise<CatalogFragrance[]> {
  // The trigram tokenizer needs at least three characters; shorter queries
  // fall back to an indexed-free scan, which is rare and still sub-second.
  const indexedTerm = [...terms]
    .filter((term) => term.length >= 3)
    .sort((a, b) => b.length - a.length)[0];
  const filters = terms.filter((term) => term !== indexedTerm);
  const conditions = filters
    .map(() => "instr(f.name_key || ' ' || f.house_key, ?) > 0")
    .join(" AND ");

  if (indexedTerm) {
    return selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.rowid IN (SELECT rowid FROM fragrance_search WHERE fragrance_search MATCH ?)
       ${conditions ? `AND ${conditions}` : ""}
       ORDER BY f.votes DESC
       LIMIT ${SEARCH_CANDIDATE_LIMIT}`,
      `"${indexedTerm}"`,
      ...filters,
    );
  }

  return selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
     WHERE ${conditions || "1"}
     ORDER BY f.votes DESC
     LIMIT ${SEARCH_CANDIDATE_LIMIT}`,
    ...filters,
  );
}

/**
 * Fragrances from the same house plus the most recognizable ones sharing a
 * note or accord, re-ranked by full similarity.
 */
export async function getRelatedFragrances(
  fragrance: CatalogFragrance,
  limit = 6,
): Promise<CatalogFragrance[]> {
  const termKeys = [
    ...new Set([...fragrance.accords, ...allNotes(fragrance)].map(searchKey)),
  ].filter(Boolean);

  const candidates = new Map<string, CatalogFragrance>();
  for (const entry of await selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
     WHERE f.house_slug = ?
     ORDER BY f.votes DESC
     LIMIT ${RELATED_CANDIDATE_LIMIT}`,
    fragrance.houseSlug,
  )) {
    candidates.set(entry.id, entry);
  }

  if (termKeys.length > 0) {
    const placeholders = termKeys.map(() => "?").join(",");
    for (const entry of await selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.rowid IN (
         SELECT ft.fragrance_rowid FROM fragrance_term ft
         JOIN term t ON t.id = ft.term_id
         WHERE t.term_key IN (${placeholders})
       )
       ORDER BY f.votes DESC
       LIMIT ${RELATED_CANDIDATE_LIMIT}`,
      ...termKeys,
    )) {
      candidates.set(entry.id, entry);
    }
  }
  candidates.delete(fragrance.id);

  return [...candidates.values()]
    .map((candidate) => ({
      candidate,
      score: getCatalogSimilarity(fragrance, candidate).rankScore,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.votes ?? 0) - (a.candidate.votes ?? 0) ||
        b.candidate.rating - a.candidate.rating,
    )
    .slice(0, Math.max(1, limit))
    .map(({ candidate }) => candidate);
}

export function getCatalogSimilarity(
  first: CatalogFragrance,
  second: CatalogFragrance,
): CatalogSimilarity {
  const similarity = scoreFragranceSimilarity(first, second);
  return {
    score: similarity.scentScore,
    rankScore: similarity.overallScore,
    sharedAccords: similarity.sharedAccords,
    sharedNotes: similarity.sharedNotes,
    sameHouse: similarity.sameHouse,
  };
}

/**
 * Well-rated, reasonably known fragrances used as the recommendation universe.
 * Memoized: the catalog is a build artifact, so it cannot change while the
 * process is alive.
 */
let recommendationCandidates: CatalogFragrance[] | undefined;
let recommendationCandidatesPromise:
  | Promise<CatalogFragrance[]>
  | undefined;

export async function getRecommendationCandidates(
  limit = 2500,
): Promise<readonly CatalogFragrance[]> {
  if (!recommendationCandidates) {
    recommendationCandidatesPromise ??= selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.rating >= 3.6 AND f.votes >= 25 AND f.accord_count > 0
       ORDER BY f.popularity DESC, f.name
       LIMIT ${RECOMMENDATION_CANDIDATE_LIMIT}`,
    ).then((rows) => {
      recommendationCandidates = rows;
      return rows;
    });
    await recommendationCandidatesPromise;
  }
  const pool = recommendationCandidates!;
  return pool.slice(0, Math.max(1, Math.min(limit, pool.length)));
}

/**
 * The recognizable slice of the catalog every game mode draws from. Bounded so
 * pool building stays constant-cost as the catalog grows.
 */
let gamePool: CatalogFragrance[] | undefined;
let gamePoolPromise: Promise<CatalogFragrance[]> | undefined;

export async function getGamePoolFragrances(): Promise<
  readonly CatalogFragrance[]
> {
  if (!gamePool) {
    gamePoolPromise ??= selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.in_game_pool = 1
       ORDER BY f.votes DESC, f.rating DESC, f.name
       LIMIT ${GAME_POOL_LIMIT}`,
    ).then((rows) => {
      gamePool = rows;
      return rows;
    });
    await gamePoolPromise;
  }
  return gamePool!;
}

/**
 * Scentle's answer pool: recognizable fragrances with enough note and accord
 * detail for the similarity feedback to be meaningful.
 */
let scentlePool: CatalogFragrance[] | undefined;
let scentlePoolPromise: Promise<CatalogFragrance[]> | undefined;

export async function getScentleDailyPool(): Promise<
  readonly CatalogFragrance[]
> {
  if (!scentlePool) {
    scentlePoolPromise ??= selectFragrances(
      `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
       WHERE f.year > 0 AND f.rating > 0 AND f.votes >= 250
         AND f.note_count >= 3 AND f.accord_count >= 2
       ORDER BY f.votes DESC, f.rating DESC, f.id
       LIMIT ${SCENTLE_POOL_LIMIT}`,
    ).then((rows) => {
      scentlePool = rows;
      return rows;
    });
    await scentlePoolPromise;
  }
  return scentlePool!;
}

export interface PoolCriteria {
  /** Only fragrances the community has actually rated. */
  requiresRating?: boolean;
  requiresPrice?: boolean;
  requiresDescription?: boolean;
  /** Enough accords or notes to reason about the scent profile. */
  requiresProfile?: boolean;
  /** Only bottles with an image the browser can actually load. */
  requiresImage?: boolean;
}

/**
 * Most-voted fragrances matching the given criteria. Game modes use this
 * instead of filtering the catalog in memory, so the cost is proportional to
 * the number of rounds rather than to the catalog size.
 */
export async function getPoolCandidates(
  criteria: PoolCriteria,
  limit: number,
): Promise<CatalogFragrance[]> {
  const conditions: string[] = [];
  if (criteria.requiresRating) conditions.push("f.rating > 0");
  if (criteria.requiresPrice) conditions.push("f.price > 0");
  if (criteria.requiresDescription) conditions.push("length(f.description) > 0");
  if (criteria.requiresProfile) {
    conditions.push("(f.accord_count >= 2 OR f.note_count >= 3)");
  }
  if (criteria.requiresImage) {
    // Fragella CDN hotlinks answer 403 in the browser, so they count as missing.
    conditions.push(
      "f.image_url IS NOT NULL AND instr(f.image_url, 'cdn.fragella.com') = 0",
    );
  }

  return selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
     ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY f.votes DESC, f.rating DESC, f.name
     LIMIT ?`,
    Math.max(1, Math.floor(limit)),
  );
}

/**
 * Every fragrance with a price in the range the Price Ladder treats as
 * dependable. Small enough (low thousands) to rank in memory.
 */
export async function getPricedFragrances(): Promise<CatalogFragrance[]> {
  return selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
     WHERE f.price >= 25 AND f.price <= 600
     ORDER BY f.votes DESC, f.rating DESC, f.name`,
  );
}

/** Most-voted fragrances first. */
export async function getTopFragrances(
  limit: number,
): Promise<CatalogFragrance[]> {
  return selectFragrances(
    `SELECT ${FRAGRANCE_COLUMNS} FROM fragrance f
     ORDER BY f.votes DESC, f.rating DESC, f.name
     LIMIT ?`,
    Math.max(1, Math.floor(limit)),
  );
}

export async function getPopularFragranceSlugs(
  limit = 250,
): Promise<string[]> {
  return (
    await all<{ slug: string }>(
      "SELECT slug FROM fragrance ORDER BY votes DESC, rating DESC, name LIMIT ?",
      Math.max(1, Math.floor(limit)),
    )
  ).map((row) => row.slug);
}

export async function getPopularCatalogFragrances(
  limit = 9,
): Promise<CatalogSearchResult[]> {
  return (await getTopFragrances(Math.max(1, Math.min(limit, 24)))).map(
    toSearchResult,
  );
}

/** Streams every slug so the sitemap never materializes the whole catalog. */
export async function* iterateFragranceSlugs(): AsyncGenerator<string> {
  for await (const row of iterate<{ slug: string }>(
    "SELECT slug FROM fragrance ORDER BY votes DESC",
  )) {
    yield row.slug;
  }
}

export async function getAccordNames(): Promise<string[]> {
  return (
    await all<{ term: string }>(
      "SELECT term FROM term WHERE kind = ? ORDER BY term",
      TERM_KIND.accord,
    )
  ).map((row) => row.term);
}
