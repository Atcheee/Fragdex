import { NextRequest, NextResponse } from "next/server";
import {
  getTrendExplorerData,
  normalizeTrendFilters,
} from "@/lib/fragrance-trends";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = normalizeTrendFilters({
    startYear: numberParam(params.get("start")),
    endYear: numberParam(params.get("end")),
    house: params.get("house") ?? "",
    gender: params.get("gender") ?? undefined,
    minimumRating: numberParam(params.get("rating")),
    minimumVotes: numberParam(params.get("votes")),
  });

  return NextResponse.json(await getTrendExplorerData(filters), {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=3600",
    },
  });
}

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
