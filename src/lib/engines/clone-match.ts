import { shuffle } from "../random";

export interface CloneMatchEntry {
  id: string;
  cloneSlug: string;
  cloneName: string;
  cloneHouse?: string;
  originalName: string;
  originalCatalogSlug?: string;
  clonePrice?: number;
  originalPrice?: number;
  savingsPercent?: number;
  similarityPercent?: number;
  review?: string;
}

export interface CloneMatchOption {
  slug: string;
  name: string;
  house?: string;
}

export interface CloneMatchRound {
  relationship: CloneMatchEntry;
  options: CloneMatchOption[];
  answerIndex: number;
}

export function generateCloneMatchRounds(
  entries: readonly CloneMatchEntry[],
  roundCount: number,
): CloneMatchRound[] {
  const optionsBySlug = new Map<string, CloneMatchOption>();
  for (const entry of entries) {
    if (!optionsBySlug.has(entry.cloneSlug)) {
      optionsBySlug.set(entry.cloneSlug, {
        slug: entry.cloneSlug,
        name: entry.cloneName,
        house: entry.cloneHouse,
      });
    }
  }

  const allOptions = [...optionsBySlug.values()];
  const clonesByOriginal = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = originalKey(entry);
    const cloneSlugs = clonesByOriginal.get(key) ?? new Set<string>();
    cloneSlugs.add(entry.cloneSlug);
    clonesByOriginal.set(key, cloneSlugs);
  }

  const usedOriginals = new Set<string>();
  const usedClones = new Set<string>();
  const result: CloneMatchRound[] = [];

  for (const relationship of shuffle(entries)) {
    if (result.length >= roundCount) break;

    const key = originalKey(relationship);
    if (usedOriginals.has(key) || usedClones.has(relationship.cloneSlug)) {
      continue;
    }

    const validCloneSlugs = clonesByOriginal.get(key) ?? new Set<string>();
    const distractors = shuffle(
      allOptions.filter((option) => !validCloneSlugs.has(option.slug)),
    ).slice(0, 3);
    if (distractors.length < 3) continue;

    const answer = optionsBySlug.get(relationship.cloneSlug);
    if (!answer) continue;

    const options = shuffle([answer, ...distractors]);
    result.push({
      relationship,
      options,
      answerIndex: options.findIndex(
        (option) => option.slug === relationship.cloneSlug,
      ),
    });
    usedOriginals.add(key);
    usedClones.add(relationship.cloneSlug);
  }

  return result;
}

function originalKey(entry: CloneMatchEntry): string {
  return (
    entry.originalCatalogSlug ??
    entry.originalName.trim().toLocaleLowerCase("en-US")
  );
}
