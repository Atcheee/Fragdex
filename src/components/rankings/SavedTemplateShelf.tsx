"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, Stack } from "@phosphor-icons/react";
import type { RankingTemplateVersion } from "@/lib/rankings";
import { loadTemplates } from "@/lib/rankings-storage";

export function SavedTemplateShelf() {
  const hydrated = useSyncExternalStore(emptySubscribe, clientReady, serverReady);
  const templates: RankingTemplateVersion[] = hydrated ? loadTemplates() : [];

  if (!templates.length) return null;

  return (
    <section aria-labelledby="your-ranking-templates">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            This browser
          </p>
          <h2
            id="your-ranking-templates"
            className="mt-1 font-display text-2xl font-semibold"
          >
            Your templates
          </h2>
        </div>
        <span className="text-sm text-muted">{templates.length} saved</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/rankings/board?template=${encodeURIComponent(template.templateId)}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card hover:border-accent"
          >
            <div className="relative aspect-[16/8] overflow-hidden bg-background">
              {template.coverImageUrl ? (
                <Image
                  src={template.coverImageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Stack size={38} className="text-accent" aria-hidden />
                </div>
              )}
              <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                v{template.version}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-display text-lg font-semibold">
                {template.title}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {template.items.length} items · {template.tiers.length} tiers
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                Continue ranking
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
