# This or That — Fragrance Games

A fragrance knowledge and discovery app with nineteen game modes, built with Next.js (App Router), TypeScript and Tailwind CSS.

## Game modes

| Mode | Type | Description |
| --- | --- | --- |
| Scentle | Daily guessing | Find one shared daily fragrance from weighted similarity feedback |
| Higher Rating | This or that | Pick the fragrance the community rates higher |
| Does It Cost More? | This or that | Pick the more expensive bottle |
| Contains This Note? | Yes / no | Is the note in the fragrance's pyramid? |
| Has This Main Accord? | Yes / no | Is it one of the main accords? |
| Which House? | Multiple choice | Match the fragrance to its house |
| Guess From Description | Multiple choice | Name and house redacted — identify the fragrance |
| Find Your Favorite | Bracket | Knockout tournament decided by your taste (8/16/32) |
| Find Your Perfect Fragrance | Discovery | Narrow the catalog through a preference quiz |
| Name That House's Fragrances | Timed naming | Type as many fragrances from a house as you can |
| Name Fragrances With a Note | Timed naming | Type as many fragrances containing a note as you can |
| Fragrance Connections | Connections | Choose a hand-crafted puzzle or a fresh puzzle generated from catalog metadata |
| Daily Connections | Connections | One shared, resumable attempt per UTC day |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Catalog pipeline

`src/data/fragrances.json` is the editable source of truth — scrapers and importers read and write it, and it is the only file to back up. Nothing reads it at request time.

At build time `scripts/build-catalog-db.ts` compiles it into a local SQLite seed at `src/data/generated/catalog.db`. Runtime queries go to **Turso** (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`) via `@libsql/client`. After regenerating the local DB, push it:

```bash
npm run generate:catalog   # rebuild local catalog.db from fragrances.json
npm run push:catalog       # copy local catalog.db into Turso (needs .env.local)
```

`prebuild` / `predev` still generate the local seed (and atlas). They do **not** push to Turso — run `push:catalog` when the catalog changes.

What the build precomputes, and why:

- **Interned note/accord terms.** Notes and accords become integer IDs in a `fragrance_term` link table.
- **A trigram full-text index** over "name house", so substring queries (`avent` → *Aventus*) are indexed rather than scanned.
- **Per-year term rollups** (`term_year`, `year_total`), which collapse a million-row join ahead of time so the trend explorer answers from a few hundred rows.
- **Denormalized counts** (`note_count`, `accord_count`, `popularity`) and covering indexes, so filtering and sorting never fault in the large text columns.

Query Turso through the helpers in `src/lib/catalog-db.ts` (`all`, `get`, `iterate`) rather than preparing statements directly.

### Bottle images (Vercel Blob)

Bottle `image_url` values may still point at CDN hosts (Fraganty, etc.). When an URL is already on `*.public.blob.vercel-storage.com`, the UI prefers it. To migrate a single bottle:

```bash
npm run upload:bottle -- --id <fragranceId>
```

Requires `BLOB_READ_WRITE_TOKEN` (and Turso env vars to rewrite `image_url`).

## Data

- **Built-in catalog** (default): ~135,800 fragrances across ~8,200 houses in `src/data/fragrances.json`:
  - ~150 hand-curated entries with approximate prices and descriptions (these power the price and description game modes).
  - ~8,500 entries built from the public [TidyTuesday Parfumo dataset](https://github.com/rfordatascience/tidytuesday/blob/main/data/2024/2024-12-10/readme.md) (community ratings, note pyramids, main accords, release years, vote counts). Only entries with ≥30 community votes, ≥3 notes and ≥2 accords are included. Ratings are converted from Parfumo's 0–10 scale to 0–5.
  - Regenerate/refresh with `npx tsx scripts/build-dataset.ts` (downloads the CSV on first run).
- **Commercial API enrichment** (optional): `npx tsx scripts/import-api-data.ts` merges data from [Fragella](https://api.fragella.com) (includes real prices) and the [FragranceFinder API on RapidAPI](https://rapidapi.com/remote-skills-remote-skills-default/api/fragrancefinder-api) (descriptions + notes via `GET /perfumes/search?q=`). Put keys in `.env.local`:

  ```bash
  FRAGELLA_API_KEY=your-key        # https://api.fragella.com — free tier: 20 requests/month
  RAPIDAPI_KEY=your-key            # subscribe to FragranceFinder API — free tier: 20 requests/month
  ```

  Free tiers are tiny, so the script caches every response in `scripts/api-cache/`, spends a configurable request budget per source (`FRAGELLA_BUDGET`/`RAPIDAPI_BUDGET`, default 15), queries curated houses first, and can be scoped with `--houses "Dior,Chanel"`. Existing entries are never overwritten — API data only fills gaps (price, description, rating, year, notes) and appends new fragrances. Re-run `npx tsx scripts/rebuild-from-cache.ts` any time to rematerialize Fragella rows from the cache at zero API cost.
  - Game pools are biased toward the most-voted fragrances so rounds stay recognizable; naming challenges and house decoys draw from a popular subset (≥100 votes).
  - Values are approximate and for entertainment only.
- **The Scent Base scraper**: `npx tsx scripts/scrape-scentbase.ts --designers Afnan,Dior --merge` imports brand and perfume pages without using Fragrantica. `--popular --limit-designers 5 --merge` processes well-known houses first. Every perfume must load a real bottle image on both its brand listing and detail page before it can enter the cache or catalog; failed bottles are reported and skipped. Re-runs reuse `scripts/scentbase-cache/`. Add `--refresh` to recheck pages and images.
- **Fraganty API** (optional): request a free key at api@fraganty.ai (docs: [fraganty.ai/api-docs](https://fraganty.ai/api-docs)) and paste it on the Settings page. Compatible modes (Higher Rating, Contains This Note, Has This Main Accord, Find Your Favorite) then draw random pools from Fraganty's 100k+ perfume database via a server-side proxy (`src/app/api/fraganty/pool/route.ts`), falling back to the built-in catalog on any error. Modes that need prices, descriptions or the full local catalog (naming games, house decoys) always use the built-in data.

The catalog is read-only at runtime. Guests keep progress locally. Signed-in
users keep the same local-first experience while account progress syncs to
Supabase Postgres. The optional Fraganty API key always remains device-local and
is never included in account sync.

Scentle answers are selected deterministically from a recognizable catalog subset using the UTC date. Guess scoring stays server-side so the answer is not included in the initial browser payload. Its normalized score weights notes (36%), accords (24%), year (14%), house (10%), rating (8%), and vote-count popularity (8%).

## Security

- The Fraganty proxy route is rate limited to 10 requests/minute per IP (in-memory fixed window, `src/lib/rate-limit.ts`) and answers 429 with `Retry-After` when exceeded. On multi-instance/serverless deployments the limit is per instance; swap in a shared store (e.g. Upstash Redis) if you need strict global limits.
- Upstream calls have 8s timeouts, the fan-out is capped at 31 requests, API keys are format-validated before forwarding, and perfume slugs from upstream responses are pattern-checked and URL-encoded before being used in URLs.
- Standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP covering `object-src`, `base-uri`, `frame-ancestors`) are set globally in `next.config.ts`.
- The optional Fraganty API key is stored only in `localStorage`; it is sent only
  to this app's proxy route and is excluded from account sync and exports.
- Account tables use Supabase Row Level Security (`auth.uid() = user_id`),
  cascading deletion, server-side session revalidation, and idempotent sync
  operations.

## Accounts and progress sync

Guests can use every game without logging in. Optional Supabase Auth adds
verified email/password, one-time email login, Google, GitHub, Microsoft,
Discord, and Facebook login. Guest data is never imported without an explicit
Import/Keep separate prompt.

Production provisioning, Brevo SMTP, OAuth callbacks, environment variables,
and launch checks are in
[`docs/authentication-setup.md`](docs/authentication-setup.md).

## Theming

Light / dark / system (default: system) via `next-themes`, toggle in the header.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- zustand (persisted store)
- next-themes

## Project layout

- `src/lib/types.ts` — domain types
- `src/lib/modes.ts` — game mode metadata
- `src/lib/catalog-db.ts` — SQLite connection and row helpers
- `src/lib/catalog.ts` — catalog lookups, search, related fragrances, game pools
- `src/lib/data-source.ts` — seed + Fraganty pool providers
- `src/lib/engines/` — pure round-generation logic per game family
- `src/components/game/` — one component per game family + controller
- `src/app/play/[mode]/` — setup and play screen for every mode
- `src/lib/api-handlers/` — API logic shared by the catch-all `/api/[...path]` route (Hobby function limit)
