import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
// import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
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
 * Whichever provider is active, session.user.email is the identifying string recorded
 * as created_by / published_by on every snapshot. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        return { id: "admin", email: adminEmail, name: process.env.ADMIN_NAME || "Administrator" };
      },
    }),
  ],
});

export type Admin = { name: string; email: string };

/** The server-side check every admin page, action and route handler makes. Middleware
 *  only redirects; this is the actual authorisation (TECH_SPEC §3). */
export async function requireAdmin(): Promise<Admin> {
  const session = await auth();
  if (!session?.user?.email) redirect("/admin/login");
  return { name: session.user.name ?? "Administrator", email: session.user.email };
}
