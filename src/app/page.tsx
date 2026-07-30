import Link from "next/link";
import { GameIcon } from "@/components/GameIcon";
import { ModeGrid } from "@/components/ModeGrid";
import { getCatalogSizeLabel } from "@/lib/catalog";

export default async function Home() {
  const catalogSize = await getCatalogSizeLabel();

  return (
    <div className="flex flex-col gap-10 pb-8 sm:gap-12">
      <section className="max-w-3xl">
        <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-6xl">
          Explore fragrance.
          <br />
          Trust <span className="text-accent">your</span> nose.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          Browse {catalogSize} perfumes, compare notes and accords, discover
          affordable alternatives, or learn through interactive scent games.
        </p>
      </section>

      <Link
        href="/play/scentle"
        prefetch={false}
        className="group flex flex-col gap-5 rounded-2xl border border-accent/30 bg-card px-6 py-5 hover:border-accent sm:flex-row sm:items-center sm:px-8"
      >
        <span className="flex size-16 shrink-0 items-center justify-center text-accent sm:size-20">
          <GameIcon modeId="scentle" size={52} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            Daily
          </span>
          <span className="mt-2 block text-xl font-semibold tracking-tight sm:text-2xl">
            Scentle
          </span>
          <span className="mt-1 block text-sm text-muted sm:text-base">
            Find today’s hidden fragrance through scent similarity.
          </span>
        </span>
        <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-9 font-semibold text-[#17120a] transition-transform group-hover:-translate-y-0.5 sm:ml-5">
          Play
        </span>
      </Link>

      <section aria-labelledby="explore-scenthub-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Fragrance research tools
          </p>
          <h2
            id="explore-scenthub-heading"
            className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Find, understand, and compare scents
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Scenthub organizes perfume profiles, note pyramids, main accords,
            ratings, release years, house collections, and sourced clone
            relationships in one searchable library.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ExploreCard
            href="/fragrances"
            title="Search the catalog"
            description={`Filter ${catalogSize} fragrances by house, accord, rating, popularity, and release year.`}
          />
          <ExploreCard
            href="/compare"
            title="Compare fragrances"
            description="Place two scents side by side to compare notes, accords, wear profiles, ratings, and similarity."
          />
          <ExploreCard
            href="/clones"
            title="Explore affordable alternatives"
            description="Review sourced clone relationships with similarity, price, savings, and community accuracy signals."
          />
        </div>
      </section>

      <ModeGrid />
    </div>
  );
}

function ExploreCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent hover:bg-card-hover"
    >
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <span className="mt-4 inline-block text-sm font-semibold text-accent">
        Explore
      </span>
    </Link>
  );
}
