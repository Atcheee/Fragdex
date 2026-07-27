import { NextRequest, NextResponse } from "next/server";
import { GET as catalogPopularGet } from "@/lib/api-handlers/catalog-popular";
import { GET as catalogSearchGet } from "@/lib/api-handlers/catalog-search";
import { POST as collectionAnalyzePost } from "@/lib/api-handlers/collection-analyze";
import { GET as fragantyPoolGet } from "@/lib/api-handlers/fraganty-pool";
import { POST as gameStartPost } from "@/lib/api-handlers/game-start";
import { POST as scentlePost } from "@/lib/api-handlers/scentle";
import {
  GET as swapNoteGet,
  POST as swapNotePost,
} from "@/lib/api-handlers/swap-note";
import { GET as trendsGet } from "@/lib/api-handlers/trends";
import { GET as authCallbackGet } from "@/lib/api-handlers/auth-callback";
import { POST as authResetPost } from "@/lib/api-handlers/auth-reset";
import {
  accountDELETE as accountDelete,
  dataDELETE as accountDataDelete,
  dataGET as accountDataGet,
  exportGET as accountExportGet,
  importPOST as accountImportPost,
  syncPOST as accountSyncPost,
} from "@/lib/api-handlers/account";
import {
  GET as cloneVotesGet,
  POST as cloneVotesPost,
} from "@/lib/api-handlers/clone-votes";
import {
  GET as fragranceVotesGet,
  POST as fragranceVotesPost,
} from "@/lib/api-handlers/fragrance-votes";

/**
 * Single catch-all for most API routes so Hobby deployments stay under the
 * 12 serverless-function limit. /api/fragrance-image stays separate (Node
 * runtime + heavy native deps).
 */
export const dynamic = "force-dynamic";

type Handler = (request: NextRequest) => Response | Promise<Response>;

const GET_HANDLERS: Record<string, Handler> = {
  "catalog/popular": (request) => catalogPopularGet(request),
  "catalog/search": (request) => catalogSearchGet(request),
  "fraganty/pool": fragantyPoolGet,
  "swap-note": (request) => swapNoteGet(request),
  trends: trendsGet,
  "auth/callback": authCallbackGet,
  "account/data": accountDataGet,
  "account/export": accountExportGet,
  "clone/votes": (request) => cloneVotesGet(request),
  "fragrance/votes": (request) => fragranceVotesGet(request),
};

const POST_HANDLERS: Record<string, Handler> = {
  "auth/reset-password": authResetPost,
  "collection/analyze": (request) => collectionAnalyzePost(request),
  "game/start": (request) => gameStartPost(request),
  scentle: (request) => scentlePost(request),
  "swap-note": (request) => swapNotePost(request),
  "account/import": accountImportPost,
  "account/sync": accountSyncPost,
  "clone/votes": (request) => cloneVotesPost(request),
  "fragrance/votes": (request) => fragranceVotesPost(request),
};

const DELETE_HANDLERS: Record<string, Handler> = {
  account: accountDelete,
  "account/data": accountDataDelete,
};

export function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return dispatch(request, context, GET_HANDLERS);
}

export function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return dispatch(request, context, POST_HANDLERS);
}

export function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return dispatch(request, context, DELETE_HANDLERS);
}

async function dispatch(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  handlers: Record<string, Handler>,
) {
  const { path } = await context.params;
  const key = path.join("/");
  const handler = handlers[key];
  if (!handler) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return handler(request);
}
