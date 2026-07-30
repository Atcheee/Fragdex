"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  DownloadSimple,
  Eye,
  FloppyDisk,
  ImageSquare,
  Plus,
  PushPin,
  ShareNetwork,
  Trash,
} from "@phosphor-icons/react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  addTemporaryItem,
  addTier,
  createBoard,
  createId,
  findItemLocation,
  moveItem,
  removeTier,
  reorderTier,
  resetBoard,
  updateTier,
  validateBoard,
  type ItemLocation,
  type RankingBoardState,
  type RankingItem,
  type RankingTemplateVersion,
} from "@/lib/rankings";
import {
  loadDraft,
  loadTemplate,
  saveDraft,
} from "@/lib/rankings-storage";

interface HistoryState {
  past: RankingBoardState[];
  present: RankingBoardState;
  future: RankingBoardState[];
}

export function RankingBoard({
  defaultTemplate,
  requestedTemplateId,
}: {
  defaultTemplate: RankingTemplateVersion;
  requestedTemplateId?: string;
}) {
  const hydrated = useSyncExternalStore(emptySubscribe, clientReady, serverReady);
  if (!hydrated) {
    return (
      <div className="min-h-[36rem] animate-pulse rounded-3xl border border-border bg-card" />
    );
  }

  const selected =
    requestedTemplateId && requestedTemplateId !== defaultTemplate.templateId
      ? loadTemplate(requestedTemplateId)
      : defaultTemplate;
  const template = selected ?? defaultTemplate;
  const draft = loadDraft(template.templateId);

  return (
    <HydratedRankingBoard
      key={template.id}
      template={template}
      initialBoard={
        draft && validateBoard(draft).length === 0
          ? draft
          : createBoard(template)
      }
      initialNotice={
        requestedTemplateId && !selected
          ? "Template was not found in this browser. Opened featured set."
          : ""
      }
    />
  );
}

function HydratedRankingBoard({
  template,
  initialBoard,
  initialNotice,
}: {
  template: RankingTemplateVersion;
  initialBoard: RankingBoardState;
  initialNotice: string;
}) {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initialBoard,
    future: [],
  }));
  const [draggedId, setDraggedId] = useState<string>();
  const [notice, setNotice] = useState(initialNotice);
  const [presentation, setPresentation] = useState(false);
  const [showTierSettings, setShowTierSettings] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const liveRegionRef = useRef<HTMLParagraphElement>(null);
  const board = history.present;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        saveDraft(board);
      } catch {
        setNotice("Draft is too large for browser storage.");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [board]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const itemById = useMemo(
    () => new Map(board.items.map((item) => [item.id, item])),
    [board.items],
  );
  const rankedCount = board.items.length - board.unrankedItemIds.length;

  const commit = useCallback(
    (
      transform: (current: RankingBoardState) => RankingBoardState,
      announcement?: string,
    ) => {
      setHistory((current) => {
        const next = transform(current.present);
        if (next === current.present) return current;
        return {
          past: [...current.past.slice(-49), current.present],
          present: next,
          future: [],
        };
      });
      if (announcement) {
        setNotice(announcement);
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = announcement;
        }
      }
    },
    [],
  );

  function undo() {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  }

  function placeItem(itemId: string, target: ItemLocation) {
    const item = itemById.get(itemId);
    const tier =
      target.tierId === null
        ? null
        : board.tiers.find((entry) => entry.id === target.tierId);
    commit(
      (current) => moveItem(current, itemId, target),
      `${item?.name ?? "Item"} moved to ${tier?.label ?? "unranked"}.`,
    );
  }

  function onDragStart(event: DragEvent, itemId: string) {
    setDraggedId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  }

  function onDrop(event: DragEvent, target: ItemLocation) {
    event.preventDefault();
    const itemId =
      event.dataTransfer.getData("text/plain") || draggedId || "";
    setDraggedId(undefined);
    if (itemId) placeItem(itemId, target);
  }

  function moveWithinLocation(itemId: string, direction: -1 | 1) {
    const location = findItemLocation(board, itemId);
    if (!location || location.index === undefined) return;
    placeItem(itemId, {
      tierId: location.tierId,
      index: location.index + direction,
    });
  }

  function moveAcrossTiers(itemId: string, direction: -1 | 1) {
    const location = findItemLocation(board, itemId);
    if (!location) return;
    const currentIndex =
      location.tierId === null
        ? board.tiers.length
        : board.tiers.findIndex((tier) => tier.id === location.tierId);
    const nextIndex = currentIndex + direction;
    const nextTierId =
      nextIndex >= board.tiers.length
        ? null
        : board.tiers[Math.max(0, nextIndex)]?.id;
    if (nextTierId === undefined) return;
    placeItem(itemId, { tierId: nextTierId });
  }

  function togglePinned(itemId: string) {
    const item = itemById.get(itemId);
    commit(
      (current) => ({
        ...current,
        pinnedItemIds: current.pinnedItemIds.includes(itemId)
          ? current.pinnedItemIds.filter((id) => id !== itemId)
          : [...current.pinnedItemIds, itemId],
        updatedAt: new Date().toISOString(),
      }),
      `${item?.name ?? "Item"} ${
        board.pinnedItemIds.includes(itemId) ? "unpinned" : "pinned"
      }.`,
    );
  }

  function addItem() {
    const name = newItemName.trim();
    if (!name) return;
    commit(
      (current) =>
        addTemporaryItem(current, {
          id: createId("temporary"),
          name,
          alt: name,
          temporary: true,
        }),
      `${name} added to unranked.`,
    );
    setNewItemName("");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: template.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Template link copied. Current board remains local.");
      }
    } catch {
      // User cancelled native share sheet.
    }
  }

  async function exportImage(type: "image/png" | "image/webp") {
    setNotice("Rendering image…");
    try {
      await exportBoard(board, type);
      setNotice(`${type === "image/png" ? "PNG" : "WebP"} downloaded.`);
    } catch {
      setNotice("Image export failed. Try again after images finish loading.");
    }
  }

  return (
    <div
      className={
        presentation
          ? "fixed inset-0 z-50 overflow-auto bg-[#111214] p-3 text-white sm:p-7"
          : ""
      }
    >
      <p ref={liveRegionRef} className="sr-only" aria-live="polite" />

      {!presentation ? (
        <>
          <Link
            href="/rankings"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
          >
            <ArrowLeft size={17} aria-hidden />
            Ranking templates
          </Link>

          <header className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                  {template.category}
                </span>
                <span className="text-xs text-muted">
                  Template v{template.version}
                </span>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                {template.title}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted">
                {template.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolbarButton
                label="Undo"
                onClick={undo}
                disabled={!history.past.length}
                icon={<ArrowCounterClockwise size={18} />}
              />
              <ToolbarButton
                label="Redo"
                onClick={redo}
                disabled={!history.future.length}
                icon={
                  <ArrowCounterClockwise
                    size={18}
                    className="-scale-x-100"
                  />
                }
              />
              <ToolbarButton
                label="Present"
                onClick={() => setPresentation(true)}
                icon={<Eye size={18} />}
              />
              <ToolbarButton
                label="Share"
                onClick={share}
                icon={<ShareNetwork size={18} />}
              />
            </div>
          </header>

          <section className="mt-7 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">
                  Ranking title (optional)
                </span>
                <input
                  value={board.title}
                  onChange={(event) =>
                    commit((current) => ({
                      ...current,
                      title: event.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  maxLength={90}
                  placeholder="My definitive ranking"
                  className={inputClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">
                  Visibility
                </span>
                <select
                  value={board.visibility}
                  onChange={(event) =>
                    commit((current) => ({
                      ...current,
                      visibility: event.target
                        .value as RankingBoardState["visibility"],
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  className={inputClass}
                >
                  <option value="private">Private draft</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolbarButton
                label="PNG"
                onClick={() => exportImage("image/png")}
                icon={<DownloadSimple size={18} />}
              />
              <ToolbarButton
                label="WebP"
                onClick={() => exportImage("image/webp")}
                icon={<ImageSquare size={18} />}
              />
              <ToolbarButton
                label="Reset"
                onClick={() =>
                  commit(
                    (current) => resetBoard(current),
                    "Board reset. Undo is available.",
                  )
                }
                icon={<ArrowCounterClockwise size={18} />}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f5a400]">
              {board.title || template.title}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {rankedCount} of {board.items.length} ranked
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPresentation(false)}
            className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
          >
            Exit presentation
          </button>
        </div>
      )}

      <section
        aria-label="Ranking board"
        className={`mt-6 overflow-hidden rounded-2xl border ${
          presentation ? "border-zinc-700" : "border-border"
        } ${backgroundClass(board.background)}`}
      >
        {board.tiers.map((tier, tierIndex) => (
          <div
            key={tier.id}
            className={`grid min-h-36 border-b last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)] ${
              presentation ? "border-zinc-700" : "border-border"
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, { tierId: tier.id })}
          >
            <div
              className="relative flex min-h-20 items-center justify-center p-3 text-center font-display text-xl font-semibold text-[#17120a] sm:min-h-36 sm:border-r"
              style={{
                backgroundColor: tier.color,
                borderColor: presentation ? "#3f3f46" : "var(--border)",
              }}
            >
              {presentation ? (
                tier.label
              ) : (
                <input
                  value={tier.label}
                  onChange={(event) =>
                    commit((current) =>
                      updateTier(current, tier.id, {
                        label: event.target.value,
                      }),
                    )
                  }
                  aria-label={`Tier ${tierIndex + 1} label`}
                  maxLength={30}
                  className="w-full bg-transparent text-center text-[#17120a] outline-none"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-wrap content-start items-start gap-2 p-2 sm:p-3">
              {tier.itemIds.length ? (
                tier.itemIds.map((itemId, itemIndex) => {
                  const item = itemById.get(itemId);
                  return item ? (
                    <RankItemCard
                      key={item.id}
                      item={item}
                      displayMode={template.displayMode}
                      pinned={board.pinnedItemIds.includes(item.id)}
                      presentation={presentation}
                      location={{ tierId: tier.id, index: itemIndex }}
                      tiers={board.tiers}
                      onDragStart={onDragStart}
                      onDrop={(event) =>
                        onDrop(event, { tierId: tier.id, index: itemIndex })
                      }
                      onMove={placeItem}
                      onMoveEarlier={() => moveWithinLocation(item.id, -1)}
                      onMoveLater={() => moveWithinLocation(item.id, 1)}
                      onMoveUp={() => moveAcrossTiers(item.id, -1)}
                      onMoveDown={() => moveAcrossTiers(item.id, 1)}
                      onPin={() => togglePinned(item.id)}
                    />
                  ) : null;
                })
              ) : (
                <p className="m-auto py-8 text-sm text-zinc-500">
                  Drop items here
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {!presentation ? (
        <>
          <section
            className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, { tierId: null })}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Unranked</h2>
                <p className="mt-1 text-sm text-muted">
                  {board.unrankedItemIds.length} remaining · drag, tap controls,
                  or use keyboard
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Check size={16} className="text-success" aria-hidden />
                Autosaved in browser
              </div>
            </div>
            <div className="mt-4 flex min-h-36 flex-wrap content-start gap-2 rounded-xl border border-dashed border-border bg-background p-2 sm:p-3">
              {board.unrankedItemIds.map((itemId, itemIndex) => {
                const item = itemById.get(itemId);
                return item ? (
                  <RankItemCard
                    key={item.id}
                    item={item}
                    displayMode={template.displayMode}
                    pinned={board.pinnedItemIds.includes(item.id)}
                    presentation={false}
                    location={{ tierId: null, index: itemIndex }}
                    tiers={board.tiers}
                    onDragStart={onDragStart}
                    onDrop={(event) =>
                      onDrop(event, { tierId: null, index: itemIndex })
                    }
                    onMove={placeItem}
                    onMoveEarlier={() => moveWithinLocation(item.id, -1)}
                    onMoveLater={() => moveWithinLocation(item.id, 1)}
                    onMoveUp={() => moveAcrossTiers(item.id, -1)}
                    onMoveDown={() => moveAcrossTiers(item.id, 1)}
                    onPin={() => togglePinned(item.id)}
                  />
                ) : null;
              })}
              {!board.unrankedItemIds.length ? (
                <p className="m-auto py-8 text-sm text-muted">
                  Everything ranked. Nice work.
                </p>
              ) : null}
            </div>
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <button
                type="button"
                onClick={() => setShowTierSettings((open) => !open)}
                aria-expanded={showTierSettings}
                className="flex w-full items-center justify-between font-display text-lg font-semibold"
              >
                Board settings
                <span className="text-sm font-sans text-muted">
                  {showTierSettings ? "Hide" : "Edit"}
                </span>
              </button>
              {showTierSettings ? (
                <div className="mt-4 space-y-3">
                  {board.tiers.map((tier, index) => (
                    <div
                      key={tier.id}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <input
                        type="color"
                        value={tier.color}
                        onChange={(event) =>
                          commit((current) =>
                            updateTier(current, tier.id, {
                              color: event.target.value,
                            }),
                          )
                        }
                        aria-label={`Color for ${tier.label}`}
                        className="h-10 w-10 rounded-lg border border-border bg-transparent p-1"
                      />
                      <input
                        value={tier.label}
                        onChange={(event) =>
                          commit((current) =>
                            updateTier(current, tier.id, {
                              label: event.target.value,
                            }),
                          )
                        }
                        aria-label={`Tier ${index + 1} label`}
                        className={inputClass}
                      />
                      <div className="flex">
                        <SmallButton
                          label={`Move ${tier.label} up`}
                          onClick={() =>
                            commit((current) =>
                              reorderTier(current, tier.id, -1),
                            )
                          }
                          disabled={index === 0}
                        >
                          <ArrowUp size={15} />
                        </SmallButton>
                        <SmallButton
                          label={`Move ${tier.label} down`}
                          onClick={() =>
                            commit((current) =>
                              reorderTier(current, tier.id, 1),
                            )
                          }
                          disabled={index === board.tiers.length - 1}
                        >
                          <ArrowDown size={15} />
                        </SmallButton>
                        <SmallButton
                          label={`Remove ${tier.label}`}
                          onClick={() =>
                            commit(
                              (current) => removeTier(current, tier.id),
                              `${tier.label} removed. Its items are unranked.`,
                            )
                          }
                          disabled={board.tiers.length === 1}
                        >
                          <Trash size={15} />
                        </SmallButton>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      commit((current) =>
                        addTier(current, {
                          id: createId("tier"),
                          label: `Tier ${current.tiers.length + 1}`,
                          color: "#8b8b98",
                        }),
                      )
                    }
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold hover:border-accent hover:bg-card-hover"
                  >
                    <Plus size={16} weight="bold" aria-hidden />
                    Add tier
                  </button>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">
                      Board background
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {["graphite", "paper", "midnight", "wine"].map(
                        (background) => (
                          <button
                            key={background}
                            type="button"
                            onClick={() =>
                              commit((current) => ({
                                ...current,
                                background,
                                updatedAt: new Date().toISOString(),
                              }))
                            }
                            aria-pressed={board.background === background}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                              board.background === background
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-border hover:bg-card-hover"
                            }`}
                          >
                            {background}
                          </button>
                        ),
                      )}
                    </div>
                  </fieldset>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">
                Add temporary item
              </h2>
              <p className="mt-1 text-sm text-muted">
                Exists only in this ranking, not source template.
              </p>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addItem();
                }}
              >
                <input
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                  maxLength={80}
                  placeholder="Item name"
                  className={inputClass}
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-[#17120a]"
                >
                  <Plus size={17} weight="bold" aria-hidden />
                  Add
                </button>
              </form>
              <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm text-muted">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <FloppyDisk size={17} className="text-accent" aria-hidden />
                  {user ? "Local draft saved" : "Anonymous draft"}
                </p>
                <p className="mt-1 leading-6">
                  {user ? (
                    "Cloud publishing is next milestone; this board currently stays on this device."
                  ) : (
                    <>
                      Progress stays on this device.{" "}
                      <Link href="/login" className="font-semibold text-accent">
                        Sign in
                      </Link>{" "}
                      for permanent saving when cloud ranking storage launches.
                    </>
                  )}
                </p>
              </div>
            </section>
          </div>
        </>
      ) : null}

      {notice ? (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xl ${
            presentation
              ? "bg-white text-zinc-900"
              : "border border-border bg-card text-foreground"
          }`}
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function emptySubscribe() {
  return () => {};
}

function clientReady() {
  return true;
}

function serverReady() {
  return false;
}

function RankItemCard({
  item,
  displayMode,
  pinned,
  presentation,
  location,
  tiers,
  onDragStart,
  onDrop,
  onMove,
  onMoveEarlier,
  onMoveLater,
  onMoveUp,
  onMoveDown,
  onPin,
}: {
  item: RankingItem;
  displayMode: RankingTemplateVersion["displayMode"];
  pinned: boolean;
  presentation: boolean;
  location: ItemLocation;
  tiers: RankingBoardState["tiers"];
  onDragStart: (event: DragEvent, itemId: string) => void;
  onDrop: (event: DragEvent) => void;
  onMove: (itemId: string, target: ItemLocation) => void;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPin: () => void;
}) {
  return (
    <article
      draggable={!presentation}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDrop(event);
      }}
      className={`group relative w-[6.5rem] shrink-0 overflow-hidden rounded-xl border shadow-sm sm:w-[7.5rem] ${
        pinned
          ? "border-accent ring-2 ring-accent/40"
          : presentation
            ? "border-zinc-600 bg-zinc-900"
            : "border-border bg-card"
      } ${presentation ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {pinned ? (
        <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-accent p-1 text-[#17120a]">
          <PushPin size={12} weight="fill" aria-label="Pinned" />
        </span>
      ) : null}
      <div
        className={`flex aspect-square items-center justify-center overflow-hidden bg-white ${
          displayMode === "cover" ? "[&>img]:h-full [&>img]:w-full [&>img]:object-cover" : "p-1.5"
        }`}
      >
        <FragranceBottleImage
          imageUrl={item.imageUrl}
          alt={item.alt || item.name}
          width={160}
          height={160}
          sizes="120px"
          className={
            displayMode === "cover"
              ? "h-full w-full object-cover"
              : "max-h-full w-auto max-w-full object-contain"
          }
          placeholderClassName="h-16 w-auto text-zinc-300"
        />
      </div>
      <div
        className={`min-h-11 px-2 py-2 text-center text-[11px] font-semibold leading-4 ${
          presentation ? "text-zinc-100" : "text-foreground"
        }`}
      >
        {item.name}
      </div>
      {!presentation ? (
        <div className="border-t border-border bg-card p-1.5">
          <label className="sr-only" htmlFor={`move-${item.id}`}>
            Move {item.name} to a tier
          </label>
          <select
            id={`move-${item.id}`}
            value={location.tierId ?? "unranked"}
            onChange={(event) =>
              onMove(item.id, {
                tierId:
                  event.target.value === "unranked"
                    ? null
                    : event.target.value,
              })
            }
            className="min-h-7 w-full rounded-md border border-border bg-background px-1 text-[10px] font-semibold"
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
            <option value="unranked">Unranked</option>
          </select>
          <div className="mt-1 grid grid-cols-5">
            <SmallButton label={`Move ${item.name} earlier`} onClick={onMoveEarlier}>
              <ArrowLeft size={13} />
            </SmallButton>
            <SmallButton label={`Move ${item.name} later`} onClick={onMoveLater}>
              <ArrowRight size={13} />
            </SmallButton>
            <SmallButton label={`Move ${item.name} up a tier`} onClick={onMoveUp}>
              <ArrowUp size={13} />
            </SmallButton>
            <SmallButton label={`Move ${item.name} down a tier`} onClick={onMoveDown}>
              <ArrowDown size={13} />
            </SmallButton>
            <SmallButton
              label={`${pinned ? "Unpin" : "Pin"} ${item.name}`}
              onClick={onPin}
            >
              <PushPin size={13} weight={pinned ? "fill" : "regular"} />
            </SmallButton>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-accent hover:bg-card-hover disabled:opacity-35"
    >
      {icon}
      {label}
    </button>
  );
}

function SmallButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex min-h-7 items-center justify-center rounded-md text-muted hover:bg-card-hover hover:text-foreground disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function backgroundClass(background: string): string {
  switch (background) {
    case "paper":
      return "bg-[#e8e1d5] text-[#17140f]";
    case "midnight":
      return "bg-[#0b1324] text-white";
    case "wine":
      return "bg-[#231016] text-white";
    default:
      return "bg-[#17181b] text-white";
  }
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

async function exportBoard(
  board: RankingBoardState,
  type: "image/png" | "image/webp",
) {
  const width = 1400;
  const labelWidth = 170;
  const itemSize = 126;
  const itemGap = 12;
  const tierPadding = 18;
  const titleHeight = board.title ? 100 : 36;
  const maxPerRow = Math.max(
    1,
    Math.floor((width - labelWidth - tierPadding * 2) / (itemSize + itemGap)),
  );
  const tierHeights = board.tiers.map((tier) => {
    const lines = Math.max(1, Math.ceil(tier.itemIds.length / maxPerRow));
    return Math.max(150, lines * (itemSize + itemGap) + tierPadding * 2);
  });
  const height = titleHeight + tierHeights.reduce((sum, value) => sum + value, 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable.");

  context.fillStyle =
    board.background === "paper"
      ? "#e8e1d5"
      : board.background === "midnight"
        ? "#0b1324"
        : board.background === "wine"
          ? "#231016"
          : "#17181b";
  context.fillRect(0, 0, width, height);
  if (board.title) {
    context.fillStyle = board.background === "paper" ? "#17140f" : "#ffffff";
    context.font = "700 34px sans-serif";
    context.fillText(board.title, 28, 58);
  }

  const itemById = new Map(board.items.map((item) => [item.id, item]));
  let y = titleHeight;
  for (let tierIndex = 0; tierIndex < board.tiers.length; tierIndex += 1) {
    const tier = board.tiers[tierIndex];
    const tierHeight = tierHeights[tierIndex];
    context.fillStyle = tier.color;
    context.fillRect(0, y, labelWidth, tierHeight);
    context.fillStyle = "#17120a";
    context.font = "700 30px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    wrapCanvasText(context, tier.label, labelWidth / 2, y + tierHeight / 2, 140);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    for (let index = 0; index < tier.itemIds.length; index += 1) {
      const item = itemById.get(tier.itemIds[index]);
      if (!item) continue;
      const column = index % maxPerRow;
      const row = Math.floor(index / maxPerRow);
      const x = labelWidth + tierPadding + column * (itemSize + itemGap);
      const itemY = y + tierPadding + row * (itemSize + itemGap);
      context.fillStyle = "#ffffff";
      context.fillRect(x, itemY, itemSize, itemSize);
      if (item.imageUrl) {
        try {
          const image = await loadCanvasImage(item.imageUrl);
          const ratio = Math.min(
            (itemSize - 12) / image.naturalWidth,
            (itemSize - 34) / image.naturalHeight,
          );
          const imageWidth = image.naturalWidth * ratio;
          const imageHeight = image.naturalHeight * ratio;
          context.drawImage(
            image,
            x + (itemSize - imageWidth) / 2,
            itemY + 4 + (itemSize - 32 - imageHeight) / 2,
            imageWidth,
            imageHeight,
          );
        } catch {
          // Cross-origin images may deny canvas access. Name still exports.
        }
      }
      context.fillStyle = "#17120a";
      context.font = "600 13px sans-serif";
      context.textAlign = "center";
      context.fillText(
        trimCanvasText(context, item.name, itemSize - 10),
        x + itemSize / 2,
        itemY + itemSize - 11,
      );
      context.textAlign = "left";
    }

    context.strokeStyle = "#3f3f46";
    context.beginPath();
    context.moveTo(0, y + tierHeight);
    context.lineTo(width, y + tierHeight);
    context.stroke();
    y += tierHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, 0.92),
  );
  if (!blob) throw new Error("Export failed.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(board.title || "scenthub-ranking")}.${type === "image/png" ? "png" : "webp"}`;
  link.click();
  URL.revokeObjectURL(url);
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function trimCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  width: number,
): string {
  if (context.measureText(value).width <= width) return value;
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > width) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((entry, index) => {
    context.fillText(
      trimCanvasText(context, entry, width),
      x,
      y + (index - (lines.length - 1) / 2) * 36,
    );
  });
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "ranking"
  );
}
