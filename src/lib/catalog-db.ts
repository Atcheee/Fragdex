/**
 * Read-only handle on the compiled catalog (see scripts/build-catalog-db.ts).
 *
 * Opening a SQLite file is O(1) — pages are read lazily as queries touch them —
 * so importing this module costs nothing even though the catalog is >100MB.
 * That is the whole point: the previous JSON catalog had to be parsed in full
 * before the first request could be served.
 */
import "server-only";

import { DatabaseSync, type StatementSync } from "node:sqlite";
import path from "node:path";
import { CATALOG_DB_FILENAME } from "@/lib/catalog-schema";

/** What may be bound to a `?` placeholder. */
export type SqlParameter = null | number | bigint | string;

let database: DatabaseSync | undefined;
const statements = new Map<string, StatementSync>();

function databasePath(): string {
  // process.cwd() is the project root during `next dev`/`next build` and the
  // function root at runtime; next.config.ts traces the file into both.
  return path.join(process.cwd(), "src/data/generated", CATALOG_DB_FILENAME);
}

export function catalogDatabase(): DatabaseSync {
  if (database) return database;
  const file = databasePath();
  try {
    database = new DatabaseSync(file, { readOnly: true });
  } catch (cause) {
    throw new Error(
      `Could not open the catalog database at ${file}. ` +
        "Run `npm run generate:catalog` to build it from src/data/fragrances.json.",
      { cause },
    );
  }
  return database;
}

/** Prepared statements are cached because SQL text is fixed per call site. */
function query(sql: string): StatementSync {
  const cached = statements.get(sql);
  if (cached) return cached;
  const statement = catalogDatabase().prepare(sql);
  statements.set(sql, statement);
  return statement;
}

/**
 * Run a query and return its rows.
 *
 * The copy is not incidental: node:sqlite hands back objects with a null
 * prototype, and React refuses to serialize those across the Server/Client
 * Component boundary. Normalizing here means a row is safe to pass anywhere,
 * rather than every new query being one prop drill away from a build failure.
 */
export function all<Row>(sql: string, ...parameters: SqlParameter[]): Row[] {
  return query(sql)
    .all(...parameters)
    .map((row) => ({ ...row }) as Row);
}

export function get<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Row | undefined {
  const row = query(sql).get(...parameters);
  return row === undefined ? undefined : ({ ...row } as Row);
}

/** Row-at-a-time variant, for result sets too large to hold in memory. */
export function* iterate<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Generator<Row> {
  for (const row of query(sql).iterate(...parameters)) yield { ...row } as Row;
}

export function metaValue(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key)?.value;
}
