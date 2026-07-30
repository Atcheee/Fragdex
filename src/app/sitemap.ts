import type { MetadataRoute } from "next";
import { getAllHouseSlugs } from "@/lib/catalog-sitemap";
import { getCloneSlugs } from "@/lib/clone-data";
import { getFragranceFamilySlugs } from "@/lib/fragrance-families";
import { MODES } from "@/lib/modes";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/fragrances"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/houses"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/clones"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/compare"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/families"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/atlas"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/trends"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/swap-a-note"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/collection"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/about"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  const houseSlugs = await getAllHouseSlugs();

  const gameRoutes: MetadataRoute.Sitemap = MODES.map((mode) => ({
    url: absoluteUrl(`/play/${mode.id}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const cloneRoutes: MetadataRoute.Sitemap = getCloneSlugs().map((slug) => ({
    url: absoluteUrl(`/clone/${slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const houseRoutes: MetadataRoute.Sitemap = houseSlugs.map((slug) => ({
    url: absoluteUrl(`/house/${slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const familyRoutes: MetadataRoute.Sitemap = getFragranceFamilySlugs().map(
    (slug) => ({
      url: absoluteUrl(`/family/${slug}`),
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  return [
    ...staticRoutes,
    ...gameRoutes,
    ...houseRoutes,
    ...cloneRoutes,
    ...familyRoutes,
  ];
}
