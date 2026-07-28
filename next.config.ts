import type { NextConfig } from "next";
import path from "node:path";

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
    // Keep prerendering concurrency low while many catalog routes query the
    // same local SQLite database.
    staticGenerationRetryCount: 2,
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 100,
  },
  // Keep sharp external so its native image-optimizer binding stays intact.
  serverExternalPackages: ["sharp"],
  // Ship only the compressed catalog. The raw database would exceed the
  // function size cap once combined with application code and sharp.
  outputFileTracingExcludes: {
    "/*": [
      "./src/data/fragrances.json",
      "./src/data/generated/catalog.db",
    ],
  },
  outputFileTracingIncludes: {
    "/*": ["./src/data/generated/catalog.db.gz"],
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
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
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
  async redirects() {
    return [
      {
        source: "/clone/emir-cedrat-essence",
        destination: "/clone/paris-corner-emir-cedrat-essence",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
