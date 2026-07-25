import "server-only";


import { unstable_cache } from "next/cache";
import { all, metaValue, type SqlParameter } from "@/lib/catalog-db";
import { TERM_KIND, searchKey, type TermKind } from "@/lib/catalog-schema";
import type {
  TrendChart,
  TrendEra,
  TrendExplorerData,
  TrendFilters,
  TrendGender,
  TrendMover,
  TrendPeriodSummary,
  TrendRepresentative,
  TrendShare,
} from "@/lib/trend-types";

const MINIMUM_YEAR = 1900;
const MAXIMUM_YEAR = new Date().getFullYear();
const MAX_TOP_ITEMS = 8;
const CHART_SERIES_COUNT = 5;
const ERA_LENGTH = 10;

interface Bin {
  index: number;
  startYear: number;
  endYear: number;
  label: string;
}

/** Term totals for one bin, keyed by the term's normalized form. */
type BinCounts = Map<string, { name: string; count: number }>;

interface Binning {
  startYear: number;
  endYear: number;
  size: number;
}

interface TermRow {
  bin: number;
  term_key: string;
  term: string;
  count: number;
}

interface TotalRow {
  bin: number;
  count: number;
}

interface RepresentativeRow {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  slug: string;
  image_url: string | null;
  accords: string;
}

export const defaultTrendFilters: TrendFilters = {
  startYear: 2000,
  endYear: MAXIMUM_YEAR,
  house: "",
  gender: "all",
  minimumRating: 0,
  minimumVotes: 0,
};

export function normalizeTrendFilters(
  filters: Partial<Omit<TrendFilters, "gender">> & { gender?: unknown },
): TrendFilters {
  const requestedStart = integerOr(filters.startYear, defaultTrendFilters.startYear);
  const requestedEnd = integerOr(filters.endYear, defaultTrendFilters.endYear);
  const startYear = clamp(
    Math.min(requestedStart, requestedEnd),
    MINIMUM_YEAR,
    MAXIMUM_YEAR,
  );
  const endYear = clamp(
    Math.max(requestedStart, requestedEnd),
    startYear,
    MAXIMUM_YEAR,
  );

  return {
    startYear,
    endYear,
    house: filters.house?.trim() ?? "",
    gender: isTrendGender(filters.gender) ? filters.gender : "all",
    minimumRating: clamp(Number(filters.minimumRating) || 0, 0, 5),
    minimumVotes: Math.max(0, integerOr(filters.minimumVotes, 0)),
  };
}

export function buildTrendExplorerData(
  requestedFilters: Partial<TrendFilters> = {},
): TrendExplorerData {
  const filters = normalizeTrendFilters(requestedFilters);

  const periodLength = filters.endYear - filters.startYear + 1;
  const previousEnd = filters.startYear - 1;
  const previousStart = previousEnd - periodLength + 1;

  const current = summarizePeriod(filters, filters.startYear, filters.endYear);
  const previous = summarizePeriod(filters, previousStart, previousEnd);

  const bins = createBins(filters.startYear, filters.endYear);

  return {
    filters,
    availableYears: { minimum: MINIMUM_YEAR, maximum: MAXIMUM_YEAR },
    current: current.summary,
    previous: previous.summary,
    noteChart: buildChart(
      filters,
      bins,
      TERM_KIND.note,
      current.summary.topNotes.slice(0, CHART_SERIES_COUNT),
    ),
    accordChart: buildChart(
      filters,
      bins,
      TERM_KIND.accord,
      current.summary.topAccords.slice(0, CHART_SERIES_COUNT),
    ),
    rising: buildMovers(current.accords, previous.accords, "rising"),
    declining: buildMovers(current.accords, previous.accords, "declining"),
    eras: buildEras(filters),
    representatives: buildRepresentatives(
      filters,
      current.summary.topAccords,
    ),
  };
}

/**
 * The filter space is small and enumerable, so caching per combination turns
 * the handful of slow ones (house or rating/vote floors, which miss the
 * rollup) into a one-time cost rather than a per-request one.
 */
export const getTrendExplorerData = unstable_cache(
  async (filters: TrendFilters) => buildTrendExplorerData(filters),
  ["trend-explorer-v1", metaValue("generatedAt") ?? ""],
  { revalidate: 3600 },
);

/**
 * Where the trend queries read from.
 *
 * `term_year` is a build-time rollup that already collapses the
 * fragrance-to-term join, and it carries gender as a dimension, so the default
 * view and every gender cut answer in milliseconds. A house or rating/vote
 * floor drops through to the live join, which stays workable because those
 * filters are selective and the result is cached per filter combination.
 */
function usesRollup(filters: TrendFilters): boolean {
  return !filters.house && filters.minimumRating <= 0 && filters.minimumVotes <= 0;
}

/**
 * Bin index for a year, as a SQL fragment taking the bin start and size as
 * parameters. SQLite only does integer division when both operands are
 * integers, and bound JavaScript numbers arrive as floats, so the quotient has
 * to be truncated explicitly or every year lands in its own fractional bin.
 */
function binIndex(yearColumn: string): string {
  return `CAST((${yearColumn} - ?) / ? AS INTEGER)`;
}

function liveConditions(filters: TrendFilters): {
  sql: string;
  parameters: SqlParameter[];
} {
  const conditions: string[] = [];
  const parameters: SqlParameter[] = [];
  if (filters.house) {
    conditions.push("f.house_slug = ?");
    parameters.push(filters.house);
  }
  if (filters.gender !== "all") {
    // Only reached on the live path; the rollup filters by gender on its own.
    conditions.push("f.gender = ?");
    parameters.push(filters.gender);
  }
  if (filters.minimumRating > 0) {
    conditions.push("f.rating >= ?");
    parameters.push(filters.minimumRating);
  }
  if (filters.minimumVotes > 0) {
    conditions.push("f.votes >= ?");
    parameters.push(filters.minimumVotes);
  }
  return { sql: conditions.map((condition) => `AND ${condition}`).join(" "), parameters };
}

/**
 * Term counts per bin. One query regardless of how many bins are requested,
 * because the bin index is computed in SQL.
 */
function aggregateTerms(
  filters: TrendFilters,
  kind: TermKind,
  binning: Binning,
): Map<number, BinCounts> {
  const { startYear, endYear, size } = binning;
  const { sql, parameters } = liveConditions(filters);
  const rows = usesRollup(filters)
    ? all<TermRow>(
        `SELECT ${binIndex("ty.year")} AS bin, t.term_key AS term_key, t.term AS term,
                SUM(ty.count) AS count
         FROM term_year ty
         JOIN term t ON t.id = ty.term_id
         WHERE ty.kind = ? AND ty.gender = ? AND ty.year BETWEEN ? AND ?
         GROUP BY bin, ty.term_id`,
        startYear,
        size,
        kind,
        filters.gender,
        startYear,
        endYear,
      )
    : all<TermRow>(
        `SELECT ${binIndex("f.year")} AS bin, t.term_key AS term_key, t.term AS term,
                COUNT(*) AS count
         FROM fragrance_term ft
         JOIN fragrance f ON f.rowid = ft.fragrance_rowid
         JOIN term t ON t.id = ft.term_id
         WHERE t.kind = ? AND f.year BETWEEN ? AND ? ${sql}
         GROUP BY bin, ft.term_id`,
        startYear,
        size,
        kind,
        startYear,
        endYear,
        ...parameters,
      );

  const bins = new Map<number, BinCounts>();
  for (const row of rows) {
    const counts = bins.get(row.bin) ?? new Map();
    counts.set(row.term_key, { name: row.term, count: row.count });
    bins.set(row.bin, counts);
  }
  return bins;
}

/** How many fragrances fall in each bin, i.e. the percentage denominators. */
function aggregateTotals(
  filters: TrendFilters,
  binning: Binning,
): Map<number, number> {
  const { startYear, endYear, size } = binning;
  const { sql, parameters } = liveConditions(filters);
  const rows = usesRollup(filters)
    ? all<TotalRow>(
        `SELECT ${binIndex("year")} AS bin, SUM(count) AS count
         FROM year_total
         WHERE gender = ? AND year BETWEEN ? AND ?
         GROUP BY bin`,
        startYear,
        size,
        filters.gender,
        startYear,
        endYear,
      )
    : all<TotalRow>(
        `SELECT ${binIndex("f.year")} AS bin, COUNT(*) AS count
         FROM fragrance f
         WHERE f.year BETWEEN ? AND ? ${sql}
         GROUP BY bin`,
        startYear,
        size,
        startYear,
        endYear,
        ...parameters,
      );

  return new Map(rows.map((row) => [row.bin, row.count]));
}

function toShares(counts: BinCounts | undefined, total: number): Map<string, TrendShare> {
  const denominator = Math.max(total, 1);
  const shares = [...(counts ?? new Map<string, { name: string; count: number }>())]
    .map(
      ([key, item]) =>
        [
          key,
          {
            name: item.name,
            percentage: roundPercentage((item.count / denominator) * 100),
          },
        ] as const,
    )
    .sort(([, a], [, b]) => b.percentage - a.percentage || a.name.localeCompare(b.name));
  return new Map(shares);
}

function summarizePeriod(
  filters: TrendFilters,
  requestedStart: number,
  requestedEnd: number,
): {
  summary: TrendPeriodSummary;
  accords: Map<string, TrendShare>;
} {
  const startYear = Math.max(requestedStart, MINIMUM_YEAR);
  const endYear = Math.min(requestedEnd, MAXIMUM_YEAR);
  if (endYear < startYear) {
    return {
      summary: {
        startYear: requestedStart,
        endYear: requestedEnd,
        count: 0,
        topNotes: [],
        topAccords: [],
      },
      accords: new Map(),
    };
  }

  // A single bin spanning the whole period.
  const binning: Binning = { startYear, endYear, size: endYear - startYear + 1 };
  const total = aggregateTotals(filters, binning).get(0) ?? 0;
  const notes = toShares(aggregateTerms(filters, TERM_KIND.note, binning).get(0), total);
  const accords = toShares(
    aggregateTerms(filters, TERM_KIND.accord, binning).get(0),
    total,
  );

  return {
    summary: {
      startYear: requestedStart,
      endYear: requestedEnd,
      count: total,
      topNotes: [...notes.values()].slice(0, MAX_TOP_ITEMS),
      topAccords: [...accords.values()].slice(0, MAX_TOP_ITEMS),
    },
    accords,
  };
}

function createBins(startYear: number, endYear: number): Bin[] {
  const range = endYear - startYear + 1;
  const size = range <= 12 ? 2 : range <= 35 ? 5 : range <= 80 ? 10 : 20;
  const bins: Bin[] = [];
  for (let start = startYear; start <= endYear; start += size) {
    const end = Math.min(endYear, start + size - 1);
    bins.push({
      index: bins.length,
      startYear: start,
      endYear: end,
      label: start === end ? String(start) : `${start}–${end}`,
    });
  }
  return bins;
}

function buildChart(
  filters: TrendFilters,
  bins: Bin[],
  kind: TermKind,
  series: TrendShare[],
): TrendChart {
  if (bins.length === 0 || series.length === 0) {
    return { labels: bins.map((bin) => bin.label), series: [] };
  }

  const binning: Binning = {
    startYear: bins[0]!.startYear,
    endYear: bins.at(-1)!.endYear,
    size: bins[0]!.endYear - bins[0]!.startYear + 1,
  };
  const counts = aggregateTerms(filters, kind, binning);
  const totals = aggregateTotals(filters, binning);
  const shares = new Map(
    bins.map((bin) => [
      bin.index,
      toShares(counts.get(bin.index), totals.get(bin.index) ?? 0),
    ]),
  );

  return {
    labels: bins.map((bin) => bin.label),
    series: series.map((item) => ({
      name: item.name,
      values: bins.map(
        (bin) => shares.get(bin.index)?.get(searchKey(item.name))?.percentage ?? 0,
      ),
    })),
  };
}

function buildMovers(
  current: Map<string, TrendShare>,
  previous: Map<string, TrendShare>,
  direction: "rising" | "declining",
): TrendMover[] {
  const keys = new Set([...current.keys(), ...previous.keys()]);
  return [...keys]
    .map((key) => {
      const currentItem = current.get(key);
      const previousItem = previous.get(key);
      const currentPercentage = currentItem?.percentage ?? 0;
      const previousPercentage = previousItem?.percentage ?? 0;
      return {
        name: currentItem?.name ?? previousItem?.name ?? key,
        currentPercentage,
        previousPercentage,
        change: roundPercentage(currentPercentage - previousPercentage),
      };
    })
    .filter((item) =>
      direction === "rising" ? item.change > 0.25 : item.change < -0.25,
    )
    .sort((a, b) => (direction === "rising" ? b.change - a.change : a.change - b.change))
    .slice(0, 4);
}

function buildEras(filters: TrendFilters): TrendEra[] {
  const binning: Binning = {
    startYear: MINIMUM_YEAR,
    endYear: MAXIMUM_YEAR,
    size: ERA_LENGTH,
  };
  const counts = aggregateTerms(filters, TERM_KIND.accord, binning);
  const totals = aggregateTotals(filters, binning);

  const eras: TrendEra[] = [];
  for (
    let startYear = MINIMUM_YEAR, index = 0;
    startYear <= MAXIMUM_YEAR;
    startYear += ERA_LENGTH, index += 1
  ) {
    const dominant = [...toShares(counts.get(index), totals.get(index) ?? 0).values()][0];
    eras.push({
      startYear,
      endYear: Math.min(startYear + ERA_LENGTH - 1, MAXIMUM_YEAR),
      label: `${startYear}s`,
      dominantAccord: dominant?.name ?? null,
      dominantPercentage: dominant?.percentage ?? 0,
    });
  }
  return eras;
}

function buildRepresentatives(
  filters: TrendFilters,
  topAccords: TrendShare[],
): TrendRepresentative[] {
  const { sql, parameters } = liveConditions(filters);
  const rows = all<RepresentativeRow>(
    `SELECT f.id, f.name, f.house, f.year, f.rating, f.slug, f.image_url, f.accords
     FROM fragrance f
     WHERE f.year BETWEEN ? AND ? AND f.accord_count > 0 ${sql}
     ORDER BY f.votes DESC, f.rating DESC, f.year DESC
     LIMIT 6`,
    Math.max(filters.startYear, MINIMUM_YEAR),
    Math.min(filters.endYear, MAXIMUM_YEAR),
    ...parameters,
  );

  return rows.map((row) => {
    const accords = JSON.parse(row.accords) as string[];
    const accordKeys = new Set(accords.map(searchKey));
    return {
      id: row.id,
      name: row.name,
      house: row.house,
      year: row.year,
      rating: row.rating,
      slug: row.slug,
      ...(row.image_url ? { imageUrl: row.image_url } : {}),
      sharedStyle:
        topAccords.find((accord) => accordKeys.has(searchKey(accord.name)))?.name ??
        accords[0] ??
        "period pick",
    };
  });
}

function isTrendGender(value: unknown): value is TrendGender {
  return (
    value === "all" || value === "men" || value === "women" || value === "unisex"
  );
}

function integerOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}
