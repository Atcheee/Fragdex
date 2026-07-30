"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal, preconnect } from "react-dom";
import {
  ClockCounterClockwise,
  Fire,
  Heart,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import {
  getFavoriteFragrances,
  type FavoriteFragrance,
} from "@/lib/favorite-fragrances";
import {
  addRecentFragrance,
  clearRecentFragrances,
  getRecentFragrances,
  type RecentFragrance,
} from "@/lib/recent-fragrances";
import {
  getCachedCatalogSearch,
  searchCatalogClient,
  type CatalogSearchItem,
} from "@/lib/catalog-search-client";

type SearchResult = CatalogSearchItem;

type DiscoverySectionKind = "recent" | "favorites" | "popular";

interface DiscoverySection {
  kind: DiscoverySectionKind;
  items: SearchResult[];
}

export function FragranceSearch() {
  preconnect("https://fimgs.net");
  preconnect("https://img.fraganty.ai");
  preconnect("https://media.thescentbase.com");

  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [overlayOpen, setOverlayOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [favorites, setFavorites] = useState<FavoriteFragrance[]>(() =>
    getFavoriteFragrances().slice(0, 9),
  );
  const [recent, setRecent] = useState<RecentFragrance[]>(
    getRecentFragrances,
  );
  const [popular, setPopular] = useState<SearchResult[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const mounted = typeof document !== "undefined";

  const normalizedQuery = query.trim();
  const searching = normalizedQuery.length >= 2;

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.id)),
    [favorites],
  );

  const recentItems = useMemo(
    () => recent.filter((item) => !favoriteIds.has(item.id)).slice(0, 9),
    [recent, favoriteIds],
  );

  const favoriteItems = useMemo(() => favorites.slice(0, 9), [favorites]);

  const popularItems = useMemo(() => {
    const excluded = new Set([
      ...recentItems.map((item) => item.id),
      ...favoriteItems.map((item) => item.id),
    ]);
    return popular.filter((item) => !excluded.has(item.id)).slice(0, 9);
  }, [popular, recentItems, favoriteItems]);

  const discoverySections = useMemo(() => {
    const sections: DiscoverySection[] = [];
    if (recentItems.length > 0) {
      sections.push({ kind: "recent", items: recentItems });
    }
    if (favoriteItems.length > 0) {
      sections.push({ kind: "favorites", items: favoriteItems });
    }
    if (popularItems.length > 0 || popularLoading) {
      sections.push({ kind: "popular", items: popularItems });
    }
    return sections;
  }, [recentItems, favoriteItems, popularItems, popularLoading]);

  const discoveryItems = useMemo(
    () => discoverySections.flatMap((section) => section.items),
    [discoverySections],
  );

  const showResults = overlayOpen && searching;
  const showDiscovery = overlayOpen && !searching;

  useEffect(() => {
    if (!overlayOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocusTarget = triggerRef.current ?? previouslyFocused;
    const frame = window.requestAnimationFrame(() => {
      overlayInputRef.current?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOverlayOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        returnFocusTarget?.focus();
      });
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen || searching) return;
    if (popular.length > 0) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPopularLoading(true);
      void (async () => {
        try {
          const response = await fetch("/api/catalog/popular?limit=9", {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Popular request failed");
          const data = (await response.json()) as { results?: SearchResult[] };
          setPopular(data.results ?? []);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setPopular([]);
          }
        } finally {
          if (!controller.signal.aborted) setPopularLoading(false);
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [overlayOpen, searching, popular.length]);

  useEffect(() => {
    if (!searching) return;

    const delay = getCachedCatalogSearch(normalizedQuery) ? 0 : 100;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const nextResults = await searchCatalogClient(normalizedQuery, {
          signal: controller.signal,
        });
        setResults(nextResults);
        setActiveIndex(nextResults.length ? 0 : -1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setActiveIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, searching]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      setFavorites(getFavoriteFragrances().slice(0, 9));
      setRecent(getRecentFragrances());
      setActiveIndex(-1);
      setOverlayOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openOverlay() {
    setFavorites(getFavoriteFragrances().slice(0, 9));
    setRecent(getRecentFragrances());
    setActiveIndex(-1);
    setOverlayOpen(true);
  }

  function closeOverlay() {
    setOverlayOpen(false);
    setActiveIndex(-1);
  }

  function goToResult(result: SearchResult) {
    addRecentFragrance(result);
    setRecent(getRecentFragrances());
    setOverlayOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    overlayInputRef.current?.blur();
    triggerRef.current?.blur();
    router.push(`/fragrance/${result.slug}`);
  }

  function handleClearRecent() {
    clearRecentFragrances();
    setRecent([]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const items = searching ? results : discoveryItems;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const result = items[activeIndex];
      if (result) goToResult(result);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
    }
  }

  const overlay =
    mounted && overlayOpen
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex cursor-default items-start justify-center px-3 py-4 sm:px-6 sm:py-16">
            <div
              aria-hidden
              className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
              onClick={closeOverlay}
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search fragrances"
              className="relative z-10 flex max-h-[min(88vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <form
                role="search"
                className="flex items-center gap-2 border-b border-border p-3 sm:p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const items = searching ? results : discoveryItems;
                  const result = items[activeIndex] ?? items[0];
                  if (result) goToResult(result);
                }}
              >
                <label htmlFor={`${listboxId}-overlay-input`} className="sr-only">
                  Search fragrances
                </label>
                <div className="relative min-w-0 flex-1">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
                  >
                    <MagnifyingGlass aria-hidden size={17} weight="regular" />
                  </span>
                  <input
                    ref={overlayInputRef}
                    id={`${listboxId}-overlay-input`}
                    type="search"
                    role="combobox"
                    value={query}
                    onChange={(event) => {
                      const nextQuery = event.target.value;
                      setQuery(nextQuery);
                      setActiveIndex(-1);
                      if (nextQuery.trim().length < 2) {
                        setResults([]);
                        setLoading(false);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search fragrances or houses…"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={
                      searching ? showResults : showDiscovery && discoverySections.length > 0
                    }
                    aria-controls={
                      searching || discoverySections.length > 0
                        ? listboxId
                        : undefined
                    }
                    aria-activedescendant={
                      activeIndex >= 0
                        ? `${listboxId}-option-${activeIndex}`
                        : undefined
                    }
                    className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-10 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  />
                  {loading ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
                    </span>
                  ) : query ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                        setLoading(false);
                        setActiveIndex(-1);
                        overlayInputRef.current?.focus();
                      }}
                      className="absolute inset-y-0 right-2 flex items-center rounded-full px-1.5 text-muted transition-colors hover:text-foreground"
                    >
                      <X aria-hidden size={16} weight="bold" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeOverlay}
                  className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground"
                >
                  Cancel
                </button>
              </form>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {showResults ? (
                  results.length > 0 ? (
                    <ul
                      id={listboxId}
                      role="listbox"
                      className="flex flex-col gap-1"
                    >
                      {results.map((result, index) => (
                        <li key={result.id}>
                          <button
                            id={`${listboxId}-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => goToResult(result)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                              index === activeIndex
                                ? "bg-accent-soft text-foreground"
                                : "hover:bg-card-hover"
                            }`}
                          >
                            <FragranceSearchResultVisual fragrance={result} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-2 py-8 text-center text-sm text-muted">
                      {loading ? "Searching…" : "No fragrances found."}
                    </p>
                  )
                ) : (
                  <DiscoveryPanel
                    listboxId={listboxId}
                    sections={discoverySections}
                    popularLoading={popularLoading}
                    activeIndex={activeIndex}
                    onActiveIndexChange={setActiveIndex}
                    onSelect={goToResult}
                    onClearRecent={handleClearRecent}
                  />
                )}
              </div>

              <p className="border-t border-border px-4 py-3 text-center text-xs text-muted">
                Press{" "}
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[0.7rem]">
                  Ctrl
                </kbd>{" "}
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[0.7rem]">
                  K
                </kbd>{" "}
                anytime to search
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative w-full max-w-none md:max-w-md">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
          >
            <MagnifyingGlass aria-hidden size={17} weight="regular" />
          </span>
          <button
            ref={triggerRef}
            type="button"
            onClick={openOverlay}
            aria-label="Search fragrances"
            aria-haspopup="dialog"
            className="h-10 w-full cursor-text rounded-full border border-border bg-card pl-10 pr-10 text-left text-base text-muted outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-soft"
          >
            Search fragrances or houses…
          </button>
        </div>
      </div>
      {overlay}
    </>
  );
}

function DiscoveryPanel({
  listboxId,
  sections,
  popularLoading,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClearRecent,
}: {
  listboxId: string;
  sections: DiscoverySection[];
  popularLoading: boolean;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (result: SearchResult) => void;
  onClearRecent: () => void;
}) {
  if (sections.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-muted">
        Start typing to search the catalog.
      </p>
    );
  }

  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label="Suggested fragrances"
      className="flex flex-col gap-6"
    >
      {sections.map((section, sectionIndex) => {
        const startIndex = sections
          .slice(0, sectionIndex)
          .reduce((total, item) => total + item.items.length, 0);
        return (
          <DiscoverySectionBlock
            key={section.kind}
            listboxId={listboxId}
            kind={section.kind}
            items={section.items}
            optionOffset={startIndex}
            loading={section.kind === "popular" && popularLoading}
            activeIndex={activeIndex}
            onActiveIndexChange={onActiveIndexChange}
            onSelect={onSelect}
            onClearRecent={onClearRecent}
          />
        );
      })}
    </div>
  );
}

function DiscoverySectionBlock({
  listboxId,
  kind,
  items,
  optionOffset,
  loading,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClearRecent,
}: {
  listboxId: string;
  kind: DiscoverySectionKind;
  items: SearchResult[];
  optionOffset: number;
  loading: boolean;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (result: SearchResult) => void;
  onClearRecent: () => void;
}) {
  const title =
    kind === "recent" ? "Recent" : kind === "favorites" ? "Favorites" : "Popular";
  const Icon =
    kind === "recent"
      ? ClockCounterClockwise
      : kind === "favorites"
        ? Heart
        : Fire;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <Icon aria-hidden size={14} weight="bold" />
          {title}
        </p>
        {kind === "recent" ? (
          <button
            type="button"
            onClick={onClearRecent}
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Clear
          </button>
        ) : kind === "favorites" ? (
          <a
            href="/favorites"
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            View all
          </a>
        ) : null}
      </div>

      {loading && items.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted">
          Loading popular fragrances…
        </p>
      ) : (
        <ul
          role="none"
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          onMouseLeave={() => onActiveIndexChange(-1)}
        >
          {items.map((item, index) => {
            const optionIndex = optionOffset + index;
            return (
              <li key={item.id}>
                <button
                  id={`${listboxId}-option-${optionIndex}`}
                  type="button"
                  role="option"
                  aria-selected={optionIndex === activeIndex}
                  onMouseEnter={() => onActiveIndexChange(optionIndex)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(item)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    optionIndex === activeIndex
                      ? "border-accent bg-accent-soft text-foreground"
                      : "border-transparent hover:border-border hover:bg-card-hover"
                  }`}
                >
                  <FragranceSearchResultVisual fragrance={item} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
