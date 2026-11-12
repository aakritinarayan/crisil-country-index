import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getVersion } from "@/lib/admin/store";
import { PREVIEW_COOKIE } from "@/lib/preview";

/* Start previewing a version: checks the session and the version, turns on Draft Mode for
 * this browser, remembers which version, and opens the public site. Opened as a plain link
 * in a new tab (never prefetched), so it only runs when an administrator clicks Preview. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/preview/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const found = await getVersion(id);
  if (!found || found.version.status === "rejected") return new Response("This version can’t be previewed.", { status: 404 });
  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, found.version.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 });
  redirect("/");
}
