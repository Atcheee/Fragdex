import type { MetadataRoute } from "next";
import { getAllHouseSummaries, iterateFragranceSlugs } from "@/lib/catalog";
import { MODES } from "@/lib/modes";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://this-or-that-fragrance-games.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/fragrances`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/houses`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const fragranceRoutes: MetadataRoute.Sitemap = [];
  for await (const slug of iterateFragranceSlugs()) {
    fragranceRoutes.push({
      url: `${siteUrl}/fragrance/${slug}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  const gameRoutes: MetadataRoute.Sitemap = MODES.map((mode) => ({
    url: `${siteUrl}/play/${mode.id}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const houseRoutes: MetadataRoute.Sitemap = (
    await getAllHouseSummaries()
  ).map((house) => ({
    url: `${siteUrl}/house/${house.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...gameRoutes, ...houseRoutes, ...fragranceRoutes];
}
