import type { NextAuthConfig } from "next-auth";

/* The part of the Auth.js config that middleware can load: session rules and the
 * redirect logic only — no providers, no password checking (that lives in lib/auth.ts). */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hours (TECH_SPEC §4)
  trustHost: true,
  providers: [],
  callbacks: {
    // Middleware decides only where a request goes; every admin page, action and route
    // handler still checks the session on the server (requireAdmin in lib/auth.ts).
    authorized({ auth, request }) {
      const signedIn = !!auth?.user;
      if (request.nextUrl.pathname === "/admin/login") {
        return signedIn ? Response.redirect(new URL("/admin", request.nextUrl)) : true;
      }
      if (signedIn) return true;
      // redirect here rather than returning false: Auth.js skips its own redirect when
      // middleware wraps a callback (see middleware.ts)
      const login = new URL("/admin/login", request.nextUrl);
      login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
      return Response.redirect(login);
    },
  },
} satisfies NextAuthConfig;
