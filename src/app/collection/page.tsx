import type { Metadata } from "next";
import { CollectionWorkbench } from "@/components/collection/CollectionWorkbench";
import { getCatalogSizeLabel } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Collection Analyzer — Scent Games",
  description:
    "Save your fragrance wardrobe, find coverage gaps, spot redundant bottles, and get transparent recommendations.",
  alternates: { canonical: "/collection" },
};

export default async function CollectionPage() {
  return (
    <CollectionWorkbench catalogSizeLabel={await getCatalogSizeLabel()} />
  );
}
