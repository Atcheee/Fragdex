import "server-only";

import { all } from "@/lib/catalog-db";

export const FRAGRANCE_SITEMAP_SIZE = 45_000;

export async function getFragranceSlugPage(
  page: number,
): Promise<string[]> {
  const safePage = Math.max(0, Math.floor(page));
  const offset = safePage * FRAGRANCE_SITEMAP_SIZE;

  return (
    await all<{ slug: string }>(
      `SELECT slug FROM fragrance
       ORDER BY votes DESC, rating DESC, name
       LIMIT ? OFFSET ?`,
      FRAGRANCE_SITEMAP_SIZE,
      offset,
    )
  ).map((row) => row.slug);
}

export async function getAllHouseSlugs(): Promise<string[]> {
  return (
    await all<{ slug: string }>(
      "SELECT slug FROM house ORDER BY fragrance_count DESC, name",
    )
  ).map((row) => row.slug);
}
