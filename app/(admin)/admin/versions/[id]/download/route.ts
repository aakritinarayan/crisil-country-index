import { requireAdmin } from "@/lib/auth";
import { getVersion, readSourceFile } from "@/lib/admin/store";

/* The workbook a version was uploaded from, exactly as uploaded. A missing file is reported,
 * never an error page: a lost file must not affect the version itself (FLOW §5). */
export async function GET(_req: Request, ctx: RouteContext<"/admin/versions/[id]/download">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const found = await getVersion(id);
  if (!found) return new Response("That version doesn’t exist.", { status: 404 });
  const file = await readSourceFile(found.version).catch(() => null);
  if (!file) return new Response("The source file for this version is no longer available.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${encodeURIComponent(found.version.source_file.filename)}"`,
      "cache-control": "private, no-store",
    },
  });
}
