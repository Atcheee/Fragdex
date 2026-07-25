import type { Metadata } from "next";
import { FragranceTrendExplorer } from "@/components/FragranceTrendExplorer";
import { getFeaturedBrowseHouses } from "@/lib/catalog-browse-fragrances";
import {
  defaultTrendFilters,
  getTrendExplorerData,
} from "@/lib/fragrance-trends";

export const metadata: Metadata = {
  title: "Fragrance Trend Explorer — This or That",
  description:
    "Compare how fragrance notes, accords, houses, and styles changed across decades.",
  alternates: { canonical: "/trends" },
};

export default async function TrendsPage() {
  const initialData = await getTrendExplorerData(defaultTrendFilters);

  return (
    <FragranceTrendExplorer
      initialData={initialData}
      houses={[...getFeaturedBrowseHouses()]}
    />
  );
}
