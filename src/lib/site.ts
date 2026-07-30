export const SITE_NAME = "Scenthub";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://scenthub.se";
export const SITE_DESCRIPTION =
  "Explore perfumes by notes, accords, houses, ratings, and release year. Compare fragrances, find affordable alternatives, and play scent games.";

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
