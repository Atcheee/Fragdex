import { MODES } from "@/lib/modes";
import { getCloneProfiles } from "@/lib/clone-data";
import type { CloneMatchEntry } from "@/lib/engines/clone-match";
import { PlayClient } from "./PlayClient";

// Every supported mode is generated below; unknown modes should be a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...MODES.map((mode) => ({ mode: mode.id })),
    { mode: "connections-generated" },
  ];
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  const cloneEntries: CloneMatchEntry[] | undefined =
    mode === "clone-match"
      ? getCloneProfiles().flatMap((profile) =>
          profile.relationships.map((relationship) => ({
            id: relationship.id,
            cloneSlug: relationship.cloneSlug,
            cloneName: relationship.cloneName,
            cloneHouse: relationship.cloneHouse,
            originalName: relationship.originalName,
            originalCatalogSlug: relationship.originalCatalogSlug,
            clonePrice: relationship.clonePrice,
            originalPrice: relationship.originalPrice,
            savingsPercent: relationship.savingsPercent,
            similarityPercent: relationship.similarityPercent,
            review: relationship.review,
          })),
        )
      : undefined;

  return <PlayClient cloneEntries={cloneEntries} />;
}
