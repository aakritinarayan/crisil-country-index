"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { processUpload } from "@/lib/admin/upload";

/** The form without scripts: upload, then the version page (validation report and change
 *  summary). With scripts the form posts to ./submit instead, to show upload progress. */
export async function uploadWorkbook(_prev: string | null, form: FormData): Promise<string | null> {
  const admin = await requireAdmin();
  const r = await processUpload(admin, form.get("file"));
  if ("error" in r) return r.error;
  redirect(`/admin/versions/${r.id}?uploaded=1`);
}
