import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/catalog";

const MAX_QUERY_LENGTH = 80;
const BROWSER_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";
const CDN_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const requestedLimit = Number(searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.floor(requestedLimit), 20))
    : 8;

  if (query.length < 2) {
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          "Cache-Control": BROWSER_CACHE_CONTROL,
          "CDN-Cache-Control": CDN_CACHE_CONTROL,
        },
      },
    );
  }

  return NextResponse.json(
    { results: await searchCatalog(query, limit) },
    {
      headers: {
        "Cache-Control": BROWSER_CACHE_CONTROL,
        "CDN-Cache-Control": CDN_CACHE_CONTROL,
      },
    },
  );
}
