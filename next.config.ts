import type { NextConfig } from "next";
import path from "node:path";

const catalogRuntimeFiles = ["./src/data/generated/catalog.db"];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Scripts/styles are left to Next.js defaults (a stricter CSP needs nonce
  // wiring); these directives are safe to enforce and block object embeds,
  // base-tag hijacking, and clickjacking.
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  },
];

const nextConfig: NextConfig = {
  // The workspace path contains spaces ("This or that"); pin the Turbopack
  // root so Next doesn't mis-infer it from a nested directory.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Keep sharp external so its native image-optimizer binding stays intact.
  serverExternalPackages: ["sharp"],
  // The catalog is read through node:sqlite at a runtime path, which the
  // bundler cannot discover. Include it only in routes that can execute after
  // build; a global include makes every Vercel function roughly 194 MB and
  // prevents Vercel from bundling routes under the Hobby function-count limit.
  outputFileTracingIncludes: {
    "/api/\\[\\.\\.\\.path\\]": catalogRuntimeFiles,
    "/compare": catalogRuntimeFiles,
    "/family/\\[slug\\]": catalogRuntimeFiles,
    "/fragrance/\\[slug\\]": catalogRuntimeFiles,
    "/fragrances": catalogRuntimeFiles,
    "/houses": catalogRuntimeFiles,
    "/trends": catalogRuntimeFiles,
  },
  // These routes read the catalog only while prerendering. Exclude the DB from
  // their server traces so Vercel can bundle the small route artifacts.
  // fragrances.json is also build-only and would duplicate the database.
  outputFileTracingExcludes: {
    "/**": ["./src/data/fragrances.json"],
    "/atlas": catalogRuntimeFiles,
    "/collection": catalogRuntimeFiles,
    "/families": catalogRuntimeFiles,
    "/house/\\[slug\\]": catalogRuntimeFiles,
    "/passport": catalogRuntimeFiles,
    "/sitemap.xml": catalogRuntimeFiles,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.fragella.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "img.fraganty.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.thescentbase.com",
        pathname: "/perfumes/**",
      },
      {
        protocol: "https",
        hostname: "fimgs.net",
        pathname: "/mdimg/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
