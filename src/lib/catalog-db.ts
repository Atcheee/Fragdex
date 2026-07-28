/**
 * Read-only handle on the generated SQLite catalog.
 *
 * Development opens the uncompressed database directly. Production traces the
 * gzip artifact and inflates it into the function's writable temp directory.
 */
import "server-only";

import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { createGunzip } from "node:zlib";

/** What may be bound to a `?` placeholder. */
export type SqlParameter = null | number | bigint | string | boolean;

const generatedDirectory = path.join(process.cwd(), "src", "data", "generated");
const localDatabasePath = path.join(generatedDirectory, "catalog.db");
const compressedDatabasePath = path.join(generatedDirectory, "catalog.db.gz");
const hydratedDatabasePath = path.join(tmpdir(), "scenthub-catalog.db");

let databasePromise: Promise<DatabaseSync> | undefined;

function sqliteParameters(parameters: SqlParameter[]): SQLInputValue[] {
  return parameters.map((parameter) =>
    typeof parameter === "boolean" ? Number(parameter) : parameter,
  );
}

function rowObject<Row>(row: Record<string, unknown>): Row {
  return { ...row } as Row;
}

async function hydrateDatabase(): Promise<string> {
  if (existsSync(hydratedDatabasePath)) return hydratedDatabasePath;
  if (!existsSync(compressedDatabasePath)) {
    throw new Error(
      `Catalog database is unavailable. Expected ${localDatabasePath} for local development ` +
        `or ${compressedDatabasePath} from the Vercel Blob prebuild download. ` +
        "Run `npm run generate:catalog` locally, or upload with `npm run upload:catalog` and redeploy.",
    );
  }

  await mkdir(path.dirname(hydratedDatabasePath), { recursive: true });
  const temporaryPath = `${hydratedDatabasePath}.${randomUUID()}.tmp`;

  try {
    await pipeline(
      createReadStream(compressedDatabasePath),
      createGunzip(),
      createWriteStream(temporaryPath, { flags: "wx" }),
    );
    await rename(temporaryPath, hydratedDatabasePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (!existsSync(hydratedDatabasePath)) throw error;
  }

  return hydratedDatabasePath;
}

async function catalogDatabase(): Promise<DatabaseSync> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const databasePath = existsSync(localDatabasePath)
        ? localDatabasePath
        : await hydrateDatabase();
      return new DatabaseSync(databasePath, {
        allowExtension: false,
        readOnly: true,
      });
    })();
  }
  return databasePromise;
}

/** Run a query and return its rows as plain objects. */
export async function all<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Promise<Row[]> {
  const statement = (await catalogDatabase()).prepare(sql);
  return statement
    .all(...sqliteParameters(parameters))
    .map((row) => rowObject<Row>(row));
}

export async function get<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Promise<Row | undefined> {
  const statement = (await catalogDatabase()).prepare(sql);
  const row = statement.get(...sqliteParameters(parameters));
  return row ? rowObject<Row>(row) : undefined;
}

/**
 * Iterate through a large result set without loading every row at once.
 * Used by the sitemap.
 */
export async function* iterate<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): AsyncGenerator<Row> {
  const statement = (await catalogDatabase()).prepare(sql);
  for (const row of statement.iterate(...sqliteParameters(parameters))) {
    yield rowObject<Row>(row);
  }
}

export async function metaValue(key: string): Promise<string | undefined> {
  return (
    await get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key)
  )?.value;
}
