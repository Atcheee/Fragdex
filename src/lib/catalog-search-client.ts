export interface CatalogSearchItem {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

const SEARCH_CACHE_LIMIT = 80;
const resultCache = new Map<string, CatalogSearchItem[]>();
const pendingSearches = new Map<string, Promise<CatalogSearchItem[]>>();

function normalizedQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function cacheKey(query: string, limit: number): string {
  return `${limit}:${normalizedQuery(query)}`;
}

function remember(key: string, results: CatalogSearchItem[]) {
  resultCache.delete(key);
  resultCache.set(key, results);
  if (resultCache.size > SEARCH_CACHE_LIMIT) {
    const oldestKey = resultCache.keys().next().value;
    if (oldestKey) resultCache.delete(oldestKey);
  }
}

export function getCachedCatalogSearch(
  query: string,
  limit = 8,
): CatalogSearchItem[] | undefined {
  const key = cacheKey(query, limit);
  const cached = resultCache.get(key);
  if (!cached) return undefined;
  remember(key, cached);
  return cached;
}

export function searchCatalogClient(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<CatalogSearchItem[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const normalized = normalizedQuery(query);
  if (normalized.length < 2) return Promise.resolve([]);

  const key = cacheKey(normalized, limit);
  const cached = getCachedCatalogSearch(normalized, limit);
  if (cached) return Promise.resolve(cached);

  let pending = pendingSearches.get(key);
  if (!pending) {
    const params = new URLSearchParams({ q: normalized });
    if (limit !== 8) params.set("limit", String(limit));

    pending = fetch(`/api/catalog/search?${params}`).then(async (response) => {
      if (!response.ok) throw new Error("Catalog search failed");
      const data = (await response.json()) as {
        results?: CatalogSearchItem[];
      };
      const results = data.results ?? [];
      remember(key, results);
      return results;
    });
    pendingSearches.set(key, pending);
    void pending.then(
      () => pendingSearches.delete(key),
      () => pendingSearches.delete(key),
    );
  }

  return options.signal ? abortable(pending, options.signal) : pending;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Search aborted", "AbortError"));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(new DOMException("Search aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
