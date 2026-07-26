import type { Metadata } from "next";
import { FragranceAtlas } from "@/components/FragranceAtlas";
import { getCatalogSizeRounded } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const catalogSize = await getCatalogSizeRounded();
  return {
    title: "Fragrance Atlas — This or That",
    description: `Explore more than ${catalogSize.toLocaleString("en-US")} fragrances on an interactive map of notes, accords, era, and rating.`,
    alternates: { canonical: "/atlas" },
  };
}

export default function AtlasPage() {
  return <FragranceAtlas />;
}
