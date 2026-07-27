import type { Metadata } from "next";
import { FragranceTrendExplorer } from "@/components/FragranceTrendExplorer";
import { getFeaturedBrowseHouses } from "@/lib/catalog-browse-fragrances";
import {
  defaultTrendFilters,
  getTrendExplorerData,
} from "@/lib/fragrance-trends";

export const metadata: Metadata = {
  title: "Fragrance Trend Explorer — Scent Games",
  description:
    "Compare how fragrance notes, accords, houses, and styles changed across decades.",
  alternates: { canonical: "/trends" },
};

export default async function TrendsPage() {
  const [initialData, featuredHouses] = await Promise.all([
    getTrendExplorerData(defaultTrendFilters),
    getFeaturedBrowseHouses(),
  ]);

  return (
    <FragranceTrendExplorer
      initialData={initialData}
      houses={[...featuredHouses]}
    />
  );
}
