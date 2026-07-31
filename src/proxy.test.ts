import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

for (const userAgent of [
  "ClaudeBot/1.0",
  "Mozilla/5.0; Claude-SearchBot/1.0",
  "Mozilla/5.0; GPTBot/1.2",
]) {
  test(`blocks abusive crawler ${userAgent}`, async () => {
    const request = new NextRequest("https://scenthub.se/fragrance/example", {
      headers: { "user-agent": userAgent },
    });

    const response = await proxy(request);

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  });
}
