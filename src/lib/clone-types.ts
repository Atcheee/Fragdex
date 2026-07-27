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

export function formatClonePrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
