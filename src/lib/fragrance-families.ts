import "server-only";

import {
  fragranceFamilyDefinitions,
  type FragranceFamilyDefinition,
  type FragranceFamilyMemberDefinition,
} from "@/data/fragrance-families";
import {
  getFragranceById,
  type CatalogFragrance,
} from "@/lib/catalog";

export interface FragranceFamilyMember
  extends FragranceFamilyMemberDefinition {
  fragrance: CatalogFragrance;
}

export interface FragranceFamily
  extends Omit<FragranceFamilyDefinition, "members"> {
  members: FragranceFamilyMember[];
}

async function resolveFamily(
  definition: FragranceFamilyDefinition,
): Promise<FragranceFamily> {
  const members = (
    await Promise.all(
      definition.members.map(async (member) => {
        const fragrance = await getFragranceById(member.fragranceId);
        if (!fragrance) {
          throw new Error(
            `Curated family "${definition.slug}" references missing fragrance "${member.fragranceId}".`,
          );
        }
        return { ...member, fragrance };
      }),
    )
  ).sort(
    (a, b) =>
      a.fragrance.year - b.fragrance.year ||
      a.fragrance.name.localeCompare(b.fragrance.name),
  );

  return { ...definition, members };
}

let familiesPromise: Promise<FragranceFamily[]> | undefined;
let familyBySlug: Map<string, FragranceFamily> | undefined;
let familyByFragranceId: Map<string, FragranceFamily> | undefined;

async function loadFamilies(): Promise<FragranceFamily[]> {
  if (!familiesPromise) {
    familiesPromise = Promise.all(
      fragranceFamilyDefinitions.map(resolveFamily),
    ).then((families) => {
      familyBySlug = new Map(families.map((family) => [family.slug, family]));
      familyByFragranceId = new Map();
      for (const family of families) {
        for (const member of family.members) {
          familyByFragranceId.set(member.fragranceId, family);
        }
      }
      return families;
    });
  }
  return familiesPromise;
}

export async function getAllFragranceFamilies(): Promise<
  readonly FragranceFamily[]
> {
  return loadFamilies();
}

export async function getFragranceFamilyBySlug(
  slug: string,
): Promise<FragranceFamily | undefined> {
  await loadFamilies();
  return familyBySlug!.get(slug);
}

export async function getFragranceFamilyForFragrance(
  fragranceId: string,
): Promise<FragranceFamily | undefined> {
  await loadFamilies();
  return familyByFragranceId!.get(fragranceId);
}

export function getFragranceFamilySlugs(): string[] {
  return fragranceFamilyDefinitions.map((family) => family.slug);
}
