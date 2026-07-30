import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Scenthub and our fragrance data",
  description:
    "Learn how Scenthub organizes fragrance notes, accords, ratings, comparisons, family trees, clone relationships, and community signals.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    title: "About Scenthub and our fragrance data",
    description:
      "How Scenthub organizes fragrance data, builds comparison tools, and labels approximate or sourced information.",
    url: "/about",
  },
};

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": absoluteUrl("/about#page"),
  url: absoluteUrl("/about"),
  name: "About Scenthub and our fragrance data",
  description:
    "How Scenthub organizes fragrance data, builds comparison tools, and labels approximate or sourced information.",
  about: { "@id": absoluteUrl("/#organization") },
  isPartOf: { "@id": absoluteUrl("/#website") },
  inLanguage: "en",
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={aboutSchema} />
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8">
        <header className="rounded-3xl border border-border bg-card p-6 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            About {SITE_NAME}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Fragrance information made easier to explore
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            Scenthub is a fragrance discovery library and set of interactive
            tools. It brings perfume profiles, note pyramids, accords, houses,
            comparisons, family trees, affordable alternatives, and scent games
            into one searchable experience.
          </p>
        </header>

        <MethodSection title="What the catalog contains">
          <p>
            Fragrance profiles may include house, release year, top, heart, and
            base notes, main accords, community rating, vote count, price,
            longevity, sillage, wear signals, descriptions, and bottle images.
            Coverage varies by fragrance, so missing fields stay visibly marked
            instead of being guessed.
          </p>
          <p>
            Start with the{" "}
            <Link href="/fragrances" className="font-semibold text-accent">
              fragrance catalog
            </Link>{" "}
            or browse the{" "}
            <Link href="/houses" className="font-semibold text-accent">
              house directory
            </Link>
            .
          </p>
        </MethodSection>

        <MethodSection title="How to interpret ratings, prices, and similarity">
          <p>
            Ratings, popularity, prices, and wear data are approximate catalog
            signals. Retail price can change by market, bottle size, seller,
            and date. A high similarity score describes a data relationship,
            not product identity or brand affiliation.
          </p>
          <p>
            Comparison and recommendation tools use available catalog fields.
            They help narrow options, but they cannot predict skin chemistry,
            reformulation differences, availability, or personal taste.
          </p>
        </MethodSection>

        <MethodSection title="Curation and source transparency">
          <p>
            Fragrance family relationships are manually curated and include
            verification links on each family page. Clone pages identify their
            listed sources, show when clone data was refreshed, separate source
            estimates from Scenthub community votes, and label sponsored links.
          </p>
          <p>
            Editorial descriptions and game explanations are written for
            discovery and education. Source-specific facts should be checked
            against the links shown on the relevant page when making a purchase
            decision.
          </p>
        </MethodSection>

        <aside className="rounded-2xl border border-accent/30 bg-accent-soft p-6">
          <h2 className="text-xl font-semibold">Important limitation</h2>
          <p className="mt-3 leading-7 text-muted">
            Scenthub is an independent discovery and entertainment site. It is
            not affiliated with fragrance houses shown in the catalog. Product
            names and trademarks belong to their respective owners.
          </p>
        </aside>
      </article>
    </>
  );
}

function MethodSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-7 text-muted">{children}</div>
    </section>
  );
}
