import "server-only";

import { del, put, type PutBlobResult } from "@vercel/blob";
import { isVercelBlobUrl } from "@/lib/blob-url";

export { isVercelBlobUrl };

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Connect a Vercel Blob store and pull env vars.",
    );
  }
  return token;
}

/** Upload a public bottle (or other) image to the connected Blob store. */
export async function putPublicBlob(
  pathname: string,
  body: Buffer | Blob | ReadableStream | string,
  contentType?: string,
): Promise<PutBlobResult> {
  return put(pathname, body, {
    access: "public",
    token: blobToken(),
    ...(contentType ? { contentType } : {}),
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}

/** Upload a private object (e.g. fragrance atlas JSON) to the connected Blob store. */
export async function putPrivateBlob(
  pathname: string,
  body: Buffer | Blob | ReadableStream | string,
  contentType?: string,
): Promise<PutBlobResult> {
  return put(pathname, body, {
    access: "private",
    token: blobToken(),
    ...(contentType ? { contentType } : {}),
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}

export async function deleteBlob(urlOrPathname: string): Promise<void> {
  await del(urlOrPathname, { token: blobToken() });
}
