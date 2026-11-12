import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { SHARE_COOKIE } from "@/lib/admin/hint";
import { isShareToken, shareCookieValue } from "@/lib/share";

/* A review link (lib/share.ts): checks the secret, turns on preview for this browser and
 * opens the site. A wrong or revoked link is a plain 404 — it says nothing about why. */
export async function GET(_req: Request, ctx: RouteContext<"/share/[token]">) {
  const { token } = await ctx.params;
  if (!isShareToken(token)) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
  (await draftMode()).enable();
  (await cookies()).set(SHARE_COOKIE, shareCookieValue()!, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 14 * 24 * 60 * 60 });
  redirect("/");
}
