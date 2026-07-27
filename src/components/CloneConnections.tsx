import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import {
  formatClonePrice,
  type CloneRelationship,
} from "@/lib/clone-data";

export function CloneAlternativesSection({
  relationships,
}: {
  relationships: CloneRelationship[];
}) {
  if (relationships.length === 0) return null;

  return (
    <section aria-labelledby="clone-alternatives-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Spend less
          </p>
          <h2
            id="clone-alternatives-heading"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            Affordable alternatives
          </h2>
          <p className="mt-1 text-sm text-muted">
            {relationships.length}{" "}
            {relationships.length === 1 ? "clone is" : "clones are"} listed for
            this fragrance.
          </p>
        </div>
        <Link
          href="/clones"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Browse all clones
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {relationships.map((relationship) => (
          <CloneConnectionCard
            key={relationship.id}
            relationship={relationship}
            direction="clone"
          />
        ))}
      </div>
    </section>
  );
}

export function CloneOriginsSection({
  relationships,
}: {
  relationships: CloneRelationship[];
}) {
  if (relationships.length === 0) return null;

  return (
    <section aria-labelledby="clone-origins-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Clone relationship
        </p>
        <h2
          id="clone-origins-heading"
          className="mt-1 text-2xl font-semibold tracking-tight"
        >
          Original inspiration
        </h2>
        <p className="mt-1 text-sm text-muted">
          This catalog fragrance appears as a clone in the alternative
          database.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {relationships.map((relationship) => (
          <CloneConnectionCard
            key={relationship.id}
            relationship={relationship}
            direction="original"
          />
        ))}
      </div>
    </section>
  );
}

function CloneConnectionCard({
  relationship,
  direction,
}: {
  relationship: CloneRelationship;
  direction: "clone" | "original";
}) {
  const title =
    direction === "clone" ? relationship.cloneName : relationship.originalName;
  const eyebrow =
    direction === "clone"
      ? relationship.cloneHouse ?? "Clone fragrance"
      : "Original fragrance";
  const href =
    direction === "clone"
      ? `/clone/${relationship.cloneSlug}`
      : relationship.originalCatalogSlug
        ? `/fragrance/${relationship.originalCatalogSlug}`
        : undefined;

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
        {eyebrow}
      </p>
      {href ? (
        <Link
          href={href}
          className="mt-1.5 font-display text-lg font-semibold leading-snug hover:text-accent"
        >
          {title}
        </Link>
      ) : (
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug">
          {title}
        </h3>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <SmallFact
          label="Similarity"
          value={
            relationship.similarityPercent !== undefined
              ? `${relationship.similarityPercent}%`
              : "Not rated"
          }
        />
        <SmallFact
          label="Clone"
          value={
            relationship.clonePrice !== undefined
              ? formatClonePrice(relationship.clonePrice)
              : "Not listed"
          }
        />
        <SmallFact
          label="Savings"
          value={
            relationship.savingsPercent !== undefined
              ? `${relationship.savingsPercent}%`
              : "Not listed"
          }
        />
      </dl>

      {relationship.review ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          {relationship.review}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-sm font-semibold">
        <Link
          href={`/clone/${relationship.cloneSlug}`}
          className="text-accent hover:underline"
        >
          Clone details
        </Link>
        {relationship.dealUrl ? (
          <a
            href={relationship.dealUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted hover:text-foreground"
          >
            Source deal
            <ArrowSquareOut aria-hidden size={14} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-2.5">
      <dt className="text-[0.6rem] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
