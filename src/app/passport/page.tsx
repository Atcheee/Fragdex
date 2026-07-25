import type { Metadata } from "next";
import { Suspense } from "react";
import { TastePassportDashboard } from "@/components/TastePassportDashboard";
import { getPoolCandidates } from "@/lib/catalog";
import { fragranceToTasteFragrance } from "@/lib/taste-passport";

export const metadata: Metadata = {
  title: "Taste Passport — This or That",
  description:
    "Your living fragrance taste profile, shaped by every game and choice.",
  alternates: { canonical: "/passport" },
};

export default function TastePassportPage() {
  const candidates = getPoolCandidates({ requiresRating: true }, 180)
    .filter((fragrance) => fragrance.year > 0)
    .map(fragranceToTasteFragrance);

  return (
    <Suspense fallback={null}>
      <TastePassportDashboard candidates={candidates} />
    </Suspense>
  );
}
