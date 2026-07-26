import "server-only";


import { unstable_cache } from "next/cache";
import { all, get, type SqlParameter } from "@/lib/catalog-db";
import { searchKey } from "@/lib/catalog-schema";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";

export interface BrowseHouseSummary {
  slug: string;
  name: string;
  fragranceCount: number;
  averageRating: number;
  firstYear: number | null;
  latestYear: number | null;
  topAccords: Array<{ name: string; count: number }>;
}

export interface HouseBrowseResult {
  total: number;
  houses: BrowseHouseSummary[];
  totalPages: number;
  page: number;
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

const SORT_ORDERS: Record<string, string> = {
  size: "fragrance_count DESC, name COLLATE NOCASE",
  name: "name COLLATE NOCASE",
  rating: "average_rating DESC, fragrance_count DESC",
  newest: "latest_year DESC, name COLLATE NOCASE",
};

function toSummary(row: HouseRow): BrowseHouseSummary {
  return {
    slug: row.slug,
    name: row.name,
    fragranceCount: row.fragrance_count,
    averageRating: row.average_rating,
    firstYear: row.first_year,
    latestYear: row.latest_year,
    topAccords: JSON.parse(row.top_accords) as BrowseHouseSummary["topAccords"],
  };
}

export async function getBrowseMeta() {
  const rows = await all<{ key: string; value: string }>(
    "SELECT key, value FROM meta",
  );
  const meta = new Map(rows.map((row) => [row.key, row.value]));
  return {
    fragranceCount: Number(meta.get("fragranceCount") ?? 0),
    houseCount: Number(meta.get("houseCount") ?? 0),
    generatedAt: meta.get("generatedAt") ?? "",
  };
}

export async function getBrowseHouseSummaries(): Promise<BrowseHouseSummary[]> {
  return (
    await all<HouseRow>("SELECT * FROM house ORDER BY name COLLATE NOCASE")
  ).map(toSummary);
}

/** House names and their top accords are both searchable, as before. */
function buildFilter(queryText: string): {
  sql: string;
  parameters: SqlParameter[];
} {
  const terms = expandBrandSearchTerms(
    searchKey(queryText).split(" ").filter(Boolean),
    searchKey,
  );
  if (terms.length === 0) return { sql: "", parameters: [] };

  return {
    sql: `WHERE ${terms.map(() => "instr(search_key, ?) > 0").join(" AND ")}`,
    parameters: terms,
  };
}

async function browseHousesUncached(
  queryText: string,
  sort: string,
  page: number,
  pageSize: number,
): Promise<HouseBrowseResult> {
  const { sql, parameters } = buildFilter(queryText);
  const order = SORT_ORDERS[sort] ?? SORT_ORDERS.size!;

  const total =
    (
      await get<{ total: number }>(
        `SELECT COUNT(*) AS total FROM house ${sql}`,
        ...parameters,
      )
    )?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const rows = await all<HouseRow>(
    `SELECT * FROM house
     ${sql}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    ...parameters,
    pageSize,
    (currentPage - 1) * pageSize,
  );

  return {
    total,
    houses: rows.map(toSummary),
    totalPages,
    page: currentPage,
  };
}

export const browseHouses = unstable_cache(
  async (queryText: string, sort: string, page: number, pageSize: number) =>
    browseHousesUncached(queryText, sort, page, pageSize),
  ["browse-houses-v5"],
  { revalidate: 3600 },
);
