import type { MetadataRoute } from "next";
import {
  getPopularFragranceSlugs,
  getPopularHouseSlugs,
} from "@/lib/catalog";
import { getCloneSlugs } from "@/lib/clone-data";
import { MODES } from "@/lib/modes";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://scenthub.se";

const SITEMAP_FRAGRANCE_LIMIT = 5_000;
const SITEMAP_HOUSE_LIMIT = 2_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/fragrances`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/houses`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/clones`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/compare`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const [fragranceSlugs, houseSlugs] = await Promise.all([
    getPopularFragranceSlugs(SITEMAP_FRAGRANCE_LIMIT),
    getPopularHouseSlugs(SITEMAP_HOUSE_LIMIT),
  ]);

  const fragranceRoutes: MetadataRoute.Sitemap = fragranceSlugs.map(
    (slug) => ({
      url: `${siteUrl}/fragrance/${slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  const gameRoutes: MetadataRoute.Sitemap = MODES.map((mode) => ({
    url: `${siteUrl}/play/${mode.id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const cloneRoutes: MetadataRoute.Sitemap = getCloneSlugs().map((slug) => ({
    url: `${siteUrl}/clone/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const houseRoutes: MetadataRoute.Sitemap = houseSlugs.map((slug) => ({
    url: `${siteUrl}/house/${slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...gameRoutes,
    ...houseRoutes,
    ...cloneRoutes,
    ...fragranceRoutes,
  ];
}
