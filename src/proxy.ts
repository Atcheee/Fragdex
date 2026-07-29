import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const BLOCKED_CRAWLER_USER_AGENTS = ["claudebot", "claude-searchbot"];

export async function proxy(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (
    BLOCKED_CRAWLER_USER_AGENTS.some((crawler) =>
      userAgent.includes(crawler),
    )
  ) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh expired auth cookies. Authorization remains in each data handler.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
