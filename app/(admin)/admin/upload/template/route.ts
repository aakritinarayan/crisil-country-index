import { requireAdmin } from "@/lib/auth";
import { latestFramework } from "@/lib/admin/store";
import { buildTemplate } from "@/lib/cfe/template";

/* The upload template, pre-filled with the current data (the live version, else the newest
 * accepted upload, else the converted assessment) so analysts edit rather than retype.
 * Admin-only: it contains the client's assessment. */
export async function GET() {
  await requireAdmin();
  const f = await latestFramework();
  const buf = await buildTemplate(f);
  const name = `country-index-template-${f?.meta.as_of ?? "blank"}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
