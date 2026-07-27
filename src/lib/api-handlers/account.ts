import { NextRequest } from "next/server";
import {
  emptyAccountSnapshot,
  mergeAccountSnapshots,
  normalizeAccountSnapshot,
} from "@/lib/account-data";
import {
  readAccountSnapshot,
  requireAccount,
  writeAccountSnapshot,
} from "@/lib/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function dataGET(): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  try {
    return Response.json(
      await readAccountSnapshot(account.supabase, account.user.id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return databaseError();
  }
}

export async function exportGET(): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  try {
    const snapshot = await readAccountSnapshot(account.supabase, account.user.id);
    return new Response(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="scent-games-data.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return databaseError();
  }
}

export async function syncPOST(request: NextRequest): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  const body = await readBody(request);
  if (!body) return invalidData();
  try {
    const revision = await writeAccountSnapshot(
      account.supabase,
      body.snapshot,
      body.operationId,
    );
    return Response.json({ ok: true, revision });
  } catch {
    return databaseError();
  }
}

export async function importPOST(request: NextRequest): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  const body = await readBody(request, true);
  if (!body?.guestId) return invalidData();
  try {
    const remote = await readAccountSnapshot(account.supabase, account.user.id);
    const merged = mergeAccountSnapshots(remote, body.snapshot);
    await writeAccountSnapshot(
      account.supabase,
      merged,
      body.operationId,
      body.guestId,
    );
    return Response.json(
      await readAccountSnapshot(account.supabase, account.user.id),
    );
  } catch {
    return databaseError();
  }
}

export async function dataDELETE(): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  try {
    await writeAccountSnapshot(
      account.supabase,
      emptyAccountSnapshot(),
      crypto.randomUUID(),
    );
    return Response.json({ ok: true });
  } catch {
    return databaseError();
  }
}

export async function accountDELETE(): Promise<Response> {
  const account = await requireAccount();
  if ("response" in account) return account.response;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Account deletion is not configured." },
      { status: 503 },
    );
  }
  const { error } = await admin.auth.admin.deleteUser(account.user.id);
  if (error) return databaseError();
  return Response.json({ ok: true });
}

async function readBody(
  request: NextRequest,
  expectsGuestId = false,
): Promise<{
  operationId: string;
  snapshot: ReturnType<typeof normalizeAccountSnapshot> & object;
  guestId?: string;
} | null> {
  try {
    const text = await request.text();
    if (text.length > 2_500_000) return null;
    const input = JSON.parse(text) as Record<string, unknown>;
    const snapshot = normalizeAccountSnapshot(input.snapshot);
    const operationId =
      typeof input.operationId === "string" ? input.operationId : "";
    const guestId = typeof input.guestId === "string" ? input.guestId : undefined;
    if (
      !snapshot ||
      !/^[0-9a-f-]{36}$/i.test(operationId) ||
      (expectsGuestId && (!guestId || guestId.length > 200))
    ) {
      return null;
    }
    return { snapshot, operationId, guestId };
  } catch {
    return null;
  }
}

function invalidData() {
  return Response.json({ error: "Invalid account data." }, { status: 400 });
}

function databaseError() {
  return Response.json(
    { error: "Account data is temporarily unavailable." },
    { status: 503 },
  );
}
