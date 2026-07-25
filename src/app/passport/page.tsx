import type { Metadata } from "next";
import { TastePassportDashboard } from "@/components/TastePassportDashboard";
import { getPoolCandidates } from "@/lib/catalog";
import { fragranceToTasteFragrance } from "@/lib/taste-passport";

export const metadata: Metadata = {
  title: "Taste Passport — This or That",
  description:
    "Your living fragrance taste profile, shaped by every game and choice.",
  alternates: { canonical: "/passport" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TastePassportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sharedValue =
    typeof params.share === "string" ? params.share : params.share?.[0];
  const candidates = getPoolCandidates({ requiresRating: true }, 180)
    .filter((fragrance) => fragrance.year > 0)
    .map(fragranceToTasteFragrance);

  return (
    <TastePassportDashboard
      candidates={candidates}
      sharedValue={sharedValue}
    />
  );
}
