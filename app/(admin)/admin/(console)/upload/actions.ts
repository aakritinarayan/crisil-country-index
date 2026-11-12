"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { capabilitiesFor } from "@/lib/admin/permissions";
import { recordUpload } from "@/lib/admin/store";
import { readWorkbook } from "@/lib/cfe/parse";
import { validate } from "@/lib/cfe/validate";
import { toPayload } from "@/lib/cfe/compute";

const MAX_BYTES = 4 * 1024 * 1024; // TECH_SPEC §5

/** Upload → validate → save as a Final version (or keep as a failed upload) → the version page,
 *  which shows the validation report and the change summary. Problems with the file itself
 *  (wrong type, too large, empty) are reported on the form and nothing is stored. */
export async function uploadWorkbook(_prev: string | null, form: FormData): Promise<string | null> {
  const admin = await requireAdmin();
  if (!capabilitiesFor(admin).has("upload")) return "Your account can’t upload workbooks.";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a workbook to upload.";
  if (!/\.xlsx$/i.test(file.name)) return "Upload an Excel workbook (.xlsx). Older .xls files and CSVs aren’t supported.";
  if (file.size > MAX_BYTES) return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 4 MB. Remove embedded images or unused sheets and try again.`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== "PK") return "This file isn’t a valid .xlsx workbook. Open it in Excel, save it as .xlsx and upload it again.";

  const { wb, issues } = await readWorkbook(buf);
  const result = wb ? validate(wb) : { framework: null, validation: { passed: false, errors: issues, warnings: [] } };
  const asOf = result.framework?.meta.as_of ?? (wb && /^\d{4}-\d{2}$/.test(wb.meta.as_of?.value ?? "") ? wb.meta.as_of.value : "");
  const record = await recordUpload({
    admin, filename: file.name, file: buf, asOf, validation: result.validation,
    framework: result.framework, payload: result.framework ? toPayload(result.framework) : null,
  });
  redirect(`/admin/versions/${record.id}?uploaded=1`);
}
