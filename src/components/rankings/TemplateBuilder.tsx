"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageSquare,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  createId,
  DEFAULT_TIERS,
  type ItemDisplayMode,
  type RankingItem,
  type RankingTemplateVersion,
  type RankingVisibility,
  type TierDefinition,
} from "@/lib/rankings";
import { saveTemplate } from "@/lib/rankings-storage";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function TemplateBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fragrance");
  const [visibility, setVisibility] =
    useState<RankingVisibility>("public");
  const [displayMode, setDisplayMode] = useState<ItemDisplayMode>("contain");
  const [coverImageUrl, setCoverImageUrl] = useState<string>();
  const [items, setItems] = useState<RankingItem[]>([]);
  const [tiers, setTiers] = useState<TierDefinition[]>(
    DEFAULT_TIERS.map((tier) => ({ ...tier })),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const ready = useMemo(
    () => title.trim().length >= 3 && items.length >= 2 && tiers.length > 0,
    [items.length, tiers.length, title],
  );

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;

    const rejected = files.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (rejected) {
      setError(
        `${rejected.name} must be a JPG, PNG, or WebP no larger than 4 MB.`,
      );
      return;
    }

    try {
      const processed = await Promise.all(
        files.map(async (file) => ({
          id: createId("item"),
          name: file.name.replace(/\.[^.]+$/, ""),
          imageUrl: await optimizeImage(file),
          alt: file.name.replace(/\.[^.]+$/, ""),
        })),
      );
      setItems((current) => [...current, ...processed].slice(0, 80));
      setError("");
    } catch {
      setError("One of those images could not be processed.");
    }
  }

  async function onCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      setError("Cover must be a JPG, PNG, or WebP no larger than 4 MB.");
      return;
    }
    try {
      setCoverImageUrl(await optimizeImage(file, 960));
      setError("");
    } catch {
      setError("Cover image could not be processed.");
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveTier(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tiers.length) return;
    setTiers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function createTemplate() {
    if (!ready) {
      setError("Add a title, at least two items, and one tier.");
      return;
    }
    setSaving(true);
    const templateId = createId("template");
    const template: RankingTemplateVersion = {
      id: `${templateId}:v1`,
      templateId,
      version: 1,
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || "Other",
      visibility,
      coverImageUrl,
      displayMode,
      items: items.map((item) => ({
        ...item,
        name: item.name.trim() || "Untitled item",
        attribution: item.attribution?.trim(),
        alt: item.alt?.trim() || item.name.trim() || "Ranking item",
      })),
      tiers,
      createdAt: new Date().toISOString(),
    };
    try {
      saveTemplate(template);
      router.push(`/rankings/board?template=${encodeURIComponent(templateId)}`);
    } catch {
      setSaving(false);
      setError(
        "Browser storage is full. Remove some images or use smaller files.",
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-8">
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Step 1 · Details
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            Name your template
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={90}
                placeholder="Best vanilla fragrances"
                className={inputClass}
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={600}
                rows={3}
                placeholder="What should rankers consider?"
                className={inputClass}
              />
            </Field>
            <Field label="Category">
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                maxLength={40}
                className={inputClass}
              />
            </Field>
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as RankingVisibility)
                }
                className={inputClass}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </Field>
            <Field label="Item crop">
              <select
                value={displayMode}
                onChange={(event) =>
                  setDisplayMode(event.target.value as ItemDisplayMode)
                }
                className={inputClass}
              >
                <option value="contain">Show whole image</option>
                <option value="cover">Fill square</option>
              </select>
            </Field>
            <Field label="Cover image">
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm font-semibold hover:border-accent hover:bg-card-hover">
                <ImageSquare size={19} aria-hidden />
                {coverImageUrl ? "Replace cover" : "Choose cover"}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={onCover}
                  className="sr-only"
                />
              </label>
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Step 2 · Items
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Add images to rank
              </h2>
              <p className="mt-1 text-sm text-muted">
                JPG, PNG, or WebP · 4 MB each · up to 80 items
              </p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-[#17120a]">
              <UploadSimple size={18} weight="bold" aria-hidden />
              Upload images
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={onFiles}
                className="sr-only"
              />
            </label>
          </div>

          {items.length ? (
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-border bg-background p-3"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="72px"
                        unoptimized
                        className={
                          displayMode === "cover"
                            ? "object-cover"
                            : "object-contain p-1"
                        }
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <input
                      value={item.name}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      aria-label={`Name for item ${index + 1}`}
                      maxLength={80}
                      className={`${inputClass} min-h-9 py-1.5`}
                    />
                    <input
                      value={item.attribution ?? ""}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  attribution: event.target.value,
                                }
                              : entry,
                          ),
                        )
                      }
                      aria-label={`Source for ${item.name || `item ${index + 1}`}`}
                      placeholder="Source / credit (optional)"
                      maxLength={120}
                      className={`${inputClass} min-h-9 py-1.5 text-xs`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <IconButton
                      label={`Move ${item.name} earlier`}
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton
                      label={`Move ${item.name} later`}
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton
                      label={`Remove ${item.name}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                    >
                      <Trash size={16} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <label className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-6 text-center hover:border-accent">
              <UploadSimple size={32} className="text-accent" aria-hidden />
              <span className="mt-3 font-semibold">Choose multiple images</span>
              <span className="mt-1 text-sm text-muted">
                Names come from filenames. Edit them anytime.
              </span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={onFiles}
                className="sr-only"
              />
            </label>
          )}
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Step 3 · Tiers
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">
            Set ranking rows
          </h2>
          <ol className="mt-4 space-y-2">
            {tiers.map((tier, index) => (
              <li
                key={tier.id}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2"
              >
                <input
                  type="color"
                  value={tier.color}
                  onChange={(event) =>
                    setTiers((current) =>
                      current.map((entry) =>
                        entry.id === tier.id
                          ? { ...entry, color: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  aria-label={`Color for ${tier.label}`}
                  className="h-10 w-10 rounded-lg border border-border bg-transparent p-1"
                />
                <input
                  value={tier.label}
                  onChange={(event) =>
                    setTiers((current) =>
                      current.map((entry) =>
                        entry.id === tier.id
                          ? { ...entry, label: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  aria-label={`Tier ${index + 1} label`}
                  maxLength={30}
                  className={`${inputClass} min-h-10 py-2`}
                />
                <div className="grid grid-cols-2">
                  <IconButton
                    label={`Move ${tier.label} up`}
                    onClick={() => moveTier(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    label={`Move ${tier.label} down`}
                    onClick={() => moveTier(index, 1)}
                    disabled={index === tiers.length - 1}
                  >
                    <ArrowDown size={14} />
                  </IconButton>
                  <button
                    type="button"
                    onClick={() =>
                      setTiers((current) =>
                        current.filter((entry) => entry.id !== tier.id),
                      )
                    }
                    disabled={tiers.length === 1}
                    aria-label={`Remove ${tier.label}`}
                    className="col-span-2 mt-1 rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                  >
                    <Trash size={14} className="mx-auto" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() =>
              setTiers((current) => [
                ...current,
                {
                  id: createId("tier"),
                  label: `Tier ${current.length + 1}`,
                  color: "#8b8b98",
                },
              ])
            }
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold hover:border-accent hover:bg-card-hover"
          >
            <Plus size={16} weight="bold" aria-hidden />
            Add tier
          </button>
        </section>

        {coverImageUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-border bg-white">
            <Image
              src={coverImageUrl}
              alt="Template cover preview"
              fill
              sizes="336px"
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={createTemplate}
          disabled={!ready || saving}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-semibold text-[#17120a] disabled:opacity-40"
        >
          {saving ? "Creating…" : "Create and start ranking"}
        </button>
        <p className="text-center text-xs leading-5 text-muted">
          Draft saves in this browser. Cloud publishing will require sign-in.
        </p>
      </aside>
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
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
      className="rounded-lg p-2 text-muted hover:bg-card-hover hover:text-foreground disabled:opacity-25"
    >
      {children}
    </button>
  );
}

async function optimizeImage(file: File, maxDimension = 640): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}
