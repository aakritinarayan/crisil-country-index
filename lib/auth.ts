import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
// import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_HINT_COOKIE, PREVIEW_COOKIE } from "./admin/hint";
import { authConfig } from "./auth.config";

/* Admin sign-in. One shared admin account for now: ADMIN_EMAIL plus a bcrypt hash in
 * ADMIN_PASSWORD_HASH (generate it with `npm run admin:password`).
 *
 * TODO(decision): production sign-in is Microsoft Entra ID SSO (TECH_SPEC §4) — no
 * password for anyone to store or rotate. Swapping is this file only: replace the
 * Credentials provider with the block below and set AUTH_MICROSOFT_ENTRA_ID_ID,
 * AUTH_MICROSOFT_ENTRA_ID_SECRET and AUTH_MICROSOFT_ENTRA_ID_ISSUER.
 *
 *   MicrosoftEntraID({
 *     clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
 *     clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
 *     issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
 *   }),
 *
 * Whichever provider is active, session.user.id is the stable key recorded on every audit
 * event and snapshot (created_by / published_by), alongside the name and email at the time. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // expose the stable subject (user.id at sign-in) as session.user.id for audit records
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  // A readable, content-free hint that an administrator signed in on this browser, so the
  // static public pages can offer an Admin shortcut without asking the server. It grants
  // nothing: /admin still checks the real session.
  events: {
    async signIn() { (await cookies()).set(ADMIN_HINT_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 8 * 60 * 60 }); },
    // signing out also ends any preview in this browser
    async signOut() {
      const jar = await cookies();
      jar.delete(ADMIN_HINT_COOKIE);
      jar.delete(PREVIEW_COOKIE);
      (await draftMode()).disable();
    },
  },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(input) {
        const email = String(input?.email ?? "").trim().toLowerCase();
        const password = String(input?.password ?? "");
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const hash = process.env.ADMIN_PASSWORD_HASH;
        if (!adminEmail || !hash) {
          console.error("Admin sign-in is not configured: set ADMIN_EMAIL and ADMIN_PASSWORD_HASH.");
          return null;
        }
        // always run the hash comparison, so a wrong email costs the same time as a wrong password
        const ok = await bcrypt.compare(password, hash);
        if (!ok || email !== adminEmail) return null;
        // stable ID for the shared account; with Entra this is the user's object ID
        return { id: `local:${adminEmail}`, email: adminEmail, name: process.env.ADMIN_NAME?.trim() || null };
      },
    }),
  ],
});

/** The signed-in administrator, from the server session only. `name` is null when the
 *  identity provider doesn't supply one — the console never invents it. */
export type Admin = { id: string; name: string | null; email: string };

/** The server-side check every admin page, action and route handler makes. Middleware
 *  only redirects; this is the actual authorisation (TECH_SPEC §3). */
export async function requireAdmin(): Promise<Admin> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !user.id) redirect("/admin/login");
  return { id: user.id, name: user.name?.trim() || null, email: user.email };
}
