import "server-only";

import cloneData from "@/data/clones.json";
import { searchKey } from "@/lib/catalog-schema";

export interface CloneRelationship {
  id: string;
  cloneSlug: string;
  cloneName: string;
  cloneHouse?: string;
  cloneCatalogSlug?: string;
  originalName: string;
  originalCatalogSlug?: string;
  clonePrice?: number;
  originalPrice?: number;
  savingsPercent?: number;
  similarityPercent?: number;
  review?: string;
  dealUrl?: string;
  sourceUrls: string[];
}

export interface CloneProfile {
  slug: string;
  name: string;
  house?: string;
  catalogSlug?: string;
  relationships: CloneRelationship[];
}

export type CloneSort = "similarity" | "savings" | "price" | "name";

const relationships = cloneData.relationships as CloneRelationship[];
const profiles = buildProfiles(relationships);
const profileBySlug = new Map(
  profiles.map((profile) => [profile.slug, profile]),
);

function buildProfiles(entries: CloneRelationship[]): CloneProfile[] {
  const groups = new Map<string, CloneRelationship[]>();
  for (const relationship of entries) {
    const group = groups.get(relationship.cloneSlug) ?? [];
    group.push(relationship);
    groups.set(relationship.cloneSlug, group);
  }

  return [...groups.entries()]
    .map(([slug, group]) => ({
      slug,
      name: group[0]!.cloneName,
      house: group.find((entry) => entry.cloneHouse)?.cloneHouse,
      catalogSlug: group.find((entry) => entry.cloneCatalogSlug)
        ?.cloneCatalogSlug,
      relationships: [...group].sort(
        (a, b) =>
          (b.similarityPercent ?? -1) - (a.similarityPercent ?? -1) ||
          a.originalName.localeCompare(b.originalName),
      ),
    }))
    .sort(
      (a, b) =>
        bestSimilarity(b) - bestSimilarity(a) ||
        a.name.localeCompare(b.name),
    );
}

export function getCloneProfiles(): readonly CloneProfile[] {
  return profiles;
}

export function getCloneProfileBySlug(
  slug: string,
): CloneProfile | undefined {
  return profileBySlug.get(slug);
}

export function getCloneSlugs(): string[] {
  return profiles.map((profile) => profile.slug);
}

export function getCloneAlternativesForOriginal(
  originalCatalogSlug: string,
): CloneRelationship[] {
  return relationships.filter(
    (relationship) =>
      relationship.originalCatalogSlug === originalCatalogSlug,
  );
}

export function getOriginalsForCatalogClone(
  cloneCatalogSlug: string,
): CloneRelationship[] {
  return relationships.filter(
    (relationship) => relationship.cloneCatalogSlug === cloneCatalogSlug,
  );
}

export function filterCloneProfiles(
  query: string,
  sort: CloneSort,
): CloneProfile[] {
  const terms = searchKey(query).split(" ").filter(Boolean);
  const filtered =
    terms.length === 0
      ? [...profiles]
      : profiles.filter((profile) => {
          const haystack = searchKey(
            [
              profile.name,
              profile.house,
              ...profile.relationships.map(
                (relationship) => relationship.originalName,
              ),
            ]
              .filter(Boolean)
              .join(" "),
          );
          return terms.every((term) => haystack.includes(term));
        });

  return filtered.sort((a, b) => {
    if (sort === "name") {
      return (
        (a.house ?? "").localeCompare(b.house ?? "") ||
        a.name.localeCompare(b.name)
      );
    }
    if (sort === "price") {
      return (
        lowestClonePrice(a) - lowestClonePrice(b) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sort === "savings") {
      return (
        bestSavings(b) - bestSavings(a) || a.name.localeCompare(b.name)
      );
    }
    return (
      bestSimilarity(b) - bestSimilarity(a) ||
      a.name.localeCompare(b.name)
    );
  });
}

export function bestSimilarity(profile: CloneProfile): number {
  return Math.max(
    -1,
    ...profile.relationships.map(
      (relationship) => relationship.similarityPercent ?? -1,
    ),
  );
}

export function bestSavings(profile: CloneProfile): number {
  return Math.max(
    -1,
    ...profile.relationships.map(
      (relationship) => relationship.savingsPercent ?? -1,
    ),
  );
}

export function lowestClonePrice(profile: CloneProfile): number {
  return Math.min(
    Number.POSITIVE_INFINITY,
    ...profile.relationships
      .map((relationship) => relationship.clonePrice)
      .filter((price): price is number => price !== undefined && price > 0),
  );
}

export function formatClonePrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export const cloneDataGeneratedAt = cloneData.generatedAt;
export const cloneDataSources = cloneData.sources;
