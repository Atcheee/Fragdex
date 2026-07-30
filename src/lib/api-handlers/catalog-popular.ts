import { NextResponse } from "next/server";
import { getPopularCatalogFragrances } from "@/lib/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "9");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 9;

  return NextResponse.json(
    { results: await getPopularCatalogFragrances(limit) },
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control":
          "public, max-age=2592000, stale-while-revalidate=7776000",
      },
    },
  );
}
