# Fragdex

A fragrance catalog, comparison, and discovery platform with twenty-two game modes — built with Next.js (App Router), TypeScript and Tailwind CSS.

Live site: [https://fragdex.vercel.app](https://fragdex.vercel.app)

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

Copy `.env.example` to `.env.local` and set Turso + Supabase values for a full local run. Catalog queries go to **Turso** (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`) via `@libsql/client` — see helpers in `src/lib/catalog-db.ts`.

The proprietary catalog source, scrape/build tooling, and database migrations are **not** published in this repository. Production deploys do not regenerate the catalog at build time.

Optional atlas map data is stored in a **private** Vercel Blob object and served through `/api/atlas` (with a local `public/data/fragrance-atlas.json` fallback for development).

## Data and accounts

- Runtime fragrance catalog: Turso (read-only at request time).
- Guests keep progress locally. Signed-in users sync account progress to Supabase Postgres with Row Level Security.
- Clone pages accept community accuracy votes once the vote tables exist in your Supabase project.
- Optional Fraganty API key stays device-local and is never included in account sync.

Scentle answers are selected deterministically from a recognizable catalog subset using the UTC date. Guess scoring stays server-side so the answer is not included in the initial browser payload.

## Security

- Upstream Fraganty proxy calls are rate limited, timed out, and validated before forwarding.
- Standard security headers are set globally in `next.config.ts`.
- Account tables use Supabase RLS (`auth.uid() = user_id`), cascading deletion, and server-side session revalidation.

## Theming

Light / dark / system (default: system) via `next-themes`, toggle in the header.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- Turso / libSQL (catalog)
- Supabase Auth + Postgres (accounts)
- zustand (persisted store)
- next-themes

## Project layout

- `src/lib/types.ts` — domain types
- `src/lib/modes.ts` — game mode metadata
- `src/lib/catalog-db.ts` — Turso connection and row helpers
- `src/lib/catalog.ts` — catalog lookups, search, related fragrances, game pools
- `src/lib/data-source.ts` — seed + Fraganty pool providers
- `src/lib/engines/` — pure round-generation logic per game family
- `src/components/game/` — one component per game family + controller
- `src/app/play/[mode]/` — setup and play screen for every mode
- `src/lib/api-handlers/` — API logic shared by the catch-all `/api/[...path]` route (Hobby function limit)
