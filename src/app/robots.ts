import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://scenthub.se";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "ClaudeBot",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
