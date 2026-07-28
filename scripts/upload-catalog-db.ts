/**
 * Compress the generated SQLite catalog and upload it to private Vercel Blob.
 *
 * Usage:
 *   npm run generate:catalog
 *   npm run upload:catalog
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { put } from "@vercel/blob";

const CATALOG_BLOB_PATH = process.env.CATALOG_BLOB_PATH ?? "data/catalog.db.gz";
const generatedDirectory = path.join(process.cwd(), "src", "data", "generated");
const databasePath = path.join(generatedDirectory, "catalog.db");
const gzipPath = path.join(generatedDirectory, "catalog.db.gz");

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Missing BLOB_READ_WRITE_TOKEN");

  await mkdir(generatedDirectory, { recursive: true });
  await pipeline(
    createReadStream(databasePath),
    createGzip({ level: 9 }),
    createWriteStream(gzipPath),
  );

  const [database, gzip] = await Promise.all([
    stat(databasePath),
    stat(gzipPath),
  ]);
  console.log(
    `Compressed catalog.db: ${database.size.toLocaleString()} bytes to ${gzip.size.toLocaleString()} bytes`,
  );

  const result = await put(CATALOG_BLOB_PATH, createReadStream(gzipPath), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/gzip",
    multipart: true,
    token,
  });

  console.log(`Uploaded private blob: ${result.pathname}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
