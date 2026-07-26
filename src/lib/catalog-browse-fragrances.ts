import "server-only";


import { unstable_cache } from "next/cache";
import { all, get, type SqlParameter } from "@/lib/catalog-db";
import { searchKey } from "@/lib/catalog-schema";
import { getAccordNames } from "@/lib/catalog";
import { getBrowseMeta } from "@/lib/catalog-browse-houses";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";

export interface BrowseFragranceCard {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes: number;
  imageUrl?: string;
  slug: string;
  houseSlug: string;
  accords?: string[];
}

export interface FragranceBrowseResult {
  total: number;
  fragrances: BrowseFragranceCard[];
  totalPages: number;
  page: number;
}

interface CardRow {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes: number;
  image_url: string | null;
  slug: string;
  house_slug: string;
  accords: string;
}

const CARD_COLUMNS = `
  f.id, f.name, f.house, f.year, f.rating, f.votes, f.image_url, f.slug,
  f.house_slug, f.accords
`;

const SORT_ORDERS: Record<string, string> = {
  popular: "f.votes DESC, f.rating DESC, f.name COLLATE NOCASE",
  rating: "f.rating DESC, f.votes DESC",
  newest: "f.year DESC, f.name COLLATE NOCASE",
  name: "f.name COLLATE NOCASE",
};

function toCard(row: CardRow): BrowseFragranceCard {
  return {
    id: row.id,
    name: row.name,
    house: row.house,
    year: row.year,
    rating: row.rating,
    votes: row.votes,
    slug: row.slug,
    houseSlug: row.house_slug,
    accords: JSON.parse(row.accords) as string[],
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
  };
}

export async function getBrowseFragranceMeta() {
  return getBrowseMeta();
}

export async function getBrowseAccords(): Promise<readonly string[]> {
  return getAccordNames();
}

export async function getFeaturedBrowseHouses(): Promise<
  ReadonlyArray<{
    slug: string;
    name: string;
  }>
> {
  return all<{ slug: string; name: string }>(`
    SELECT slug, name FROM house
    ORDER BY fragrance_count DESC, name
    LIMIT 80
  `);
}

/**
 * Builds the WHERE clause shared by the count and page queries.
 *
 * Free-text terms are matched against the trigram index when they are long
 * enough for it, and against the accord list otherwise.
 */
function buildFilter(
  queryText: string,
  house: string,
  accord: string,
): { sql: string; parameters: SqlParameter[] } {
  const conditions: string[] = [];
  const parameters: SqlParameter[] = [];

  if (house) {
    conditions.push("f.house_slug = ?");
    parameters.push(house);
  }
  if (accord) {
    conditions.push(`EXISTS (
      SELECT 1 FROM fragrance_term ft
      JOIN term t ON t.id = ft.term_id
      WHERE ft.fragrance_rowid = f.rowid AND t.kind = 1 AND t.term_key = ?
    )`);
    parameters.push(searchKey(accord));
  }

  const terms = expandBrandSearchTerms(
    searchKey(queryText).split(" ").filter(Boolean),
    searchKey,
  );
  for (const term of terms) {
    if (term.length >= 3) {
      conditions.push(
        "f.rowid IN (SELECT rowid FROM fragrance_search WHERE fragrance_search MATCH ?)",
      );
      parameters.push(`"${term}"`);
    } else {
      conditions.push("instr(f.name_key || ' ' || f.house_key, ?) > 0");
      parameters.push(term);
    }
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    parameters,
  };
}

async function browseFragrancesUncached(
  queryText: string,
  house: string,
  accord: string,
  sort: string,
  page: number,
  pageSize: number,
): Promise<FragranceBrowseResult> {
  const { sql, parameters } = buildFilter(queryText, house, accord);
  const order = SORT_ORDERS[sort] ?? SORT_ORDERS.popular!;

  const total =
    (
      await get<{ total: number }>(
        `SELECT COUNT(*) AS total FROM fragrance f ${sql}`,
        ...parameters,
      )
    )?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const rows = await all<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM fragrance f
     ${sql}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    ...parameters,
    pageSize,
    (currentPage - 1) * pageSize,
  );

  return {
    total,
    fragrances: rows.map(toCard),
    totalPages,
    page: currentPage,
  };
}

export const browseFragrances = unstable_cache(
  async (
    queryText: string,
    house: string,
    accord: string,
    sort: string,
    page: number,
    pageSize: number,
  ) => browseFragrancesUncached(queryText, house, accord, sort, page, pageSize),
  ["browse-fragrances-v5"],
  { revalidate: 3600 },
);
