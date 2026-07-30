import type { MetadataRoute } from "next";
import { getCatalogSize } from "@/lib/catalog";
import { FRAGRANCE_SITEMAP_SIZE } from "@/lib/catalog-sitemap";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const catalogSize = await getCatalogSize();
  const fragranceSitemapCount = Math.max(
    1,
    Math.ceil(catalogSize / FRAGRANCE_SITEMAP_SIZE),
  );
  const fragranceSitemaps = Array.from(
    { length: fragranceSitemapCount },
    (_, id) => absoluteUrl(`/fragrance/sitemap/${id}.xml`),
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: [absoluteUrl("/sitemap.xml"), ...fragranceSitemaps],
    host: SITE_URL,
  };
}
