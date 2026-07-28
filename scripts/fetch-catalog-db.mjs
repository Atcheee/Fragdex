/**
 * Download the compressed catalog from private Vercel Blob before a build.
 */
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { get } from "@vercel/blob";

const blobPath = process.env.CATALOG_BLOB_PATH ?? "data/catalog.db.gz";
const generatedDirectory = path.join(process.cwd(), "src", "data", "generated");
const databasePath = path.join(generatedDirectory, "catalog.db");
const gzipPath = path.join(generatedDirectory, "catalog.db.gz");

if (existsSync(gzipPath)) {
  console.log(`Catalog artifact already present: ${gzipPath}`);
  process.exit(0);
}

if (!process.env.VERCEL && existsSync(databasePath)) {
  console.log(
    "Skipping catalog Blob download: local catalog.db exists.",
  );
  process.exit(0);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  throw new Error(
    "Missing BLOB_READ_WRITE_TOKEN. Vercel builds need it to download data/catalog.db.gz.",
  );
}

await mkdir(generatedDirectory, { recursive: true });
const temporaryPath = `${gzipPath}.${process.pid}.tmp`;

try {
  const result = await get(blobPath, {
    access: "private",
    token,
    useCache: false,
  });
  if (!result || result.statusCode !== 200) {
    throw new Error(`Catalog blob not found: ${blobPath}`);
  }

  await pipeline(
    Readable.fromWeb(result.stream),
    createWriteStream(temporaryPath, { flags: "wx" }),
  );
  await rename(temporaryPath, gzipPath);
  console.log(
    `Downloaded ${result.blob.size.toLocaleString()} bytes to ${gzipPath}`,
  );
} catch (error) {
  await rm(temporaryPath, { force: true });
  throw error;
}
