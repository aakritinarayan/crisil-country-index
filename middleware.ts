import type { NextFetchEvent, NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Kept as middleware.ts (not proxy.ts) by decision — see CLAUDE.md. Redirects only
// (authConfig.callbacks.authorized); authorisation itself happens on the server in
// each admin page and action.
// typing the event picks the middleware overload of auth(); the callback adds nothing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const guard = NextAuth(authConfig).auth((_request, _event: NextFetchEvent) => undefined);

export function middleware(request: NextRequest, event: NextFetchEvent) {
  // a deployment without admin settings (e.g. the public preview) says so instead of erroring
  if (!process.env.AUTH_SECRET) {
    return new Response("The admin area is not set up on this deployment.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return guard(request, event);
}

export const config = { matcher: ["/admin/:path*"] };
