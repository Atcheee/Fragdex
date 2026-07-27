import "server-only";

import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Pathname inside the private Blob store (override with ATLAS_BLOB_PATH). */
const DEFAULT_ATLAS_PATH = "data/fragrance-atlas.json";

/**
 * Serve fragrance atlas JSON from the private Vercel Blob store.
 * Falls back to the local gitignored file for offline/dev.
 */
export async function GET() {
  const pathname =
    process.env.ATLAS_BLOB_PATH?.trim() || DEFAULT_ATLAS_PATH;
  const blobUrl =
    process.env.ATLAS_BLOB_URL?.trim() ||
    (process.env.BLOB_ATLAS_BASE_URL
      ? `${process.env.BLOB_ATLAS_BASE_URL.replace(/\/$/, "")}/${pathname}`
      : undefined);

  try {
    const fromBlob = await readAtlasFromBlob(blobUrl ?? pathname);
    if (fromBlob) return fromBlob;
  } catch (error) {
    console.error("[atlas] blob fetch failed:", error);
  }

  try {
    const fromDisk = await readAtlasFromDisk();
    if (fromDisk) return fromDisk;
  } catch (error) {
    console.error("[atlas] local fallback failed:", error);
  }

  return NextResponse.json(
    { error: "Atlas data unavailable" },
    { status: 404 },
  );
}

async function readAtlasFromBlob(urlOrPathname: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !process.env.VERCEL_OIDC_TOKEN) {
    return null;
  }

  const result = await get(urlOrPathname, {
    access: "private",
    ...(token ? { token } : {}),
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Content-Type": result.blob.contentType ?? "application/json",
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      ...(result.blob.etag ? { ETag: result.blob.etag } : {}),
    },
  });
}

async function readAtlasFromDisk() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "fragrance-atlas.json",
  );
  const body = await readFile(filePath);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
