import { auth } from "@/lib/auth";
import { processUpload } from "@/lib/admin/upload";

/* The upload form's scripted path: the same processing as the server action, posted with
 * XMLHttpRequest so the browser can report upload progress. Session and same-origin are
 * checked here (a server action gets the origin check from Next; a route handler doesn't). */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "This request didn’t come from the admin." }, { status: 403 });
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return Response.json({ error: "Your session has expired. Sign in again, then upload the file." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "The upload didn’t arrive complete. Try again." }, { status: 400 });
  const r = await processUpload({ id: user.id, name: user.name?.trim() || null, email: user.email }, form.get("file"));
  if ("error" in r) return Response.json(r, { status: 400 });
  return Response.json({ url: `/admin/versions/${r.id}?uploaded=1` });
}
