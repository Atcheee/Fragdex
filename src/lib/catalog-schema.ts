/**
 * Vocabulary shared by the catalog build script and the runtime query layer.
 *
 * Everything here must stay dependency-free and side-effect-free: it is
 * imported both by `scripts/build-catalog-db.ts` (plain Node) and by
 * server modules inside the Next.js app.
 */

export const CATALOG_DB_FILENAME = "catalog.db";

/** Below this vote count a fragrance is only reachable by search or browse. */
export const GAME_POOL_MINIMUM_VOTES = 100;

export const TERM_KIND = { note: 0, accord: 1 } as const;

export type TermKind = (typeof TERM_KIND)[keyof typeof TERM_KIND];

export type CatalogGender = "men" | "women" | "unisex";

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lowercase, accent-free, single-spaced form used for matching and search. */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const WOMEN_PATTERN =
  /\b(for women|pour femme|parfum femme|eau de femme|donna|woman|women|feminine|for her)\b/;
const MEN_PATTERN =
  /\b(for men|pour homme|parfum homme|eau d'homme|uomo|homme|man|men|masculine|for him)\b/;

/**
 * Resolved once at build time so trend queries never have to scan the
 * description column, which is by far the largest field in the catalog.
 */
export function inferGender(name: string, description: string): CatalogGender {
  const text = `${name} ${description}`.toLowerCase();
  const women = WOMEN_PATTERN.test(text);
  const men = MEN_PATTERN.test(text);
  if (women && !men) return "women";
  if (men && !women) return "men";
  return "unisex";
}
