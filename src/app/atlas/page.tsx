import type { Metadata } from "next";
import { FragranceAtlas } from "@/components/FragranceAtlas";
import { getCatalogSizeRounded } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Fragrance Atlas — This or That",
  description: `Explore more than ${getCatalogSizeRounded().toLocaleString("en-US")} fragrances on an interactive map of notes, accords, era, and rating.`,
  alternates: { canonical: "/atlas" },
};

export default function AtlasPage() {
  return <FragranceAtlas />;
}
