import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { MODES, getMode } from "@/lib/modes";
import { getCloneProfiles } from "@/lib/clone-data";
import type { CloneMatchEntry } from "@/lib/engines/clone-match";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import { PlayClient } from "./PlayClient";

// Every supported mode is generated below; unknown modes should be a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...MODES.map((mode) => ({ mode: mode.id })),
    { mode: "connections-generated" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string }>;
}): Promise<Metadata> {
  const { mode } = await params;
  const meta = getMode(mode);
  if (!meta) {
    return {
      title: "Game not found",
      robots: { index: false, follow: false },
    };
  }

  const generated = mode === "connections-generated";
  const canonicalMode = generated ? "connections-curated" : mode;
  const title = `${meta.title} fragrance game — ${SITE_NAME}`;
  const description = `${meta.tagline} Play this free online fragrance game and learn more about perfume.`;

  return {
    title,
    description,
    alternates: { canonical: `/play/${canonicalMode}` },
    robots: generated ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: `/play/${canonicalMode}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  const meta = getMode(mode);
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

  const gameSchema = meta
    ? {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: meta.title,
        description: `${meta.tagline} ${meta.howTo}`,
        url: absoluteUrl(
          `/play/${
            mode === "connections-generated" ? "connections-curated" : mode
          }`,
        ),
        applicationCategory: "GameApplication",
        applicationSubCategory: "Fragrance game",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        inLanguage: "en",
        publisher: { "@id": absoluteUrl("/#organization") },
      }
    : undefined;

  return (
    <>
      {gameSchema ? <JsonLd data={gameSchema} /> : null}
      <PlayClient cloneEntries={cloneEntries} />
    </>
  );
}
