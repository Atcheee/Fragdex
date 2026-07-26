/**
 * Read-only handle on the Turso-hosted catalog (seeded from
 * scripts/build-catalog-db.ts via scripts/push-catalog-to-turso.ts).
 */
import "server-only";

import { createClient, type Client, type InValue } from "@libsql/client";

/** What may be bound to a `?` placeholder. */
export type SqlParameter = null | number | bigint | string | boolean;

let client: Client | undefined;

function catalogClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "Turso catalog is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN " +
        "(e.g. in .env.local). Seed with `npm run push:catalog` after generating the local DB.",
    );
  }
  client = createClient({ url, authToken });
  return client;
}

function toArgs(parameters: SqlParameter[]): InValue[] {
  return parameters as InValue[];
}

function rowObject<Row>(row: Record<string, unknown>): Row {
  return { ...row } as Row;
}

/** Run a query and return its rows as plain objects. */
export async function all<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Promise<Row[]> {
  const result = await catalogClient().execute({
    sql,
    args: toArgs(parameters),
  });
  return result.rows.map((row) => rowObject<Row>(row as unknown as Record<string, unknown>));
}

export async function get<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): Promise<Row | undefined> {
  const rows = await all<Row>(sql, ...parameters);
  return rows[0];
}

/**
 * Page through a large result set without loading every row at once.
 * Used by the sitemap.
 */
export async function* iterate<Row>(
  sql: string,
  ...parameters: SqlParameter[]
): AsyncGenerator<Row> {
  const pageSize = 2_000;
  let offset = 0;
  for (;;) {
    const page = await all<Row>(
      `${sql} LIMIT ? OFFSET ?`,
      ...parameters,
      pageSize,
      offset,
    );
    if (page.length === 0) return;
    for (const row of page) yield row;
    if (page.length < pageSize) return;
    offset += pageSize;
  }
}

export async function metaValue(key: string): Promise<string | undefined> {
  return (
    await get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key)
  )?.value;
}
