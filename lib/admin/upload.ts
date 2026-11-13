import "server-only";
import type { Admin } from "@/lib/auth";
import { readWorkbook } from "@/lib/cfe/parse";
import { validate } from "@/lib/cfe/validate";
import { toPayload } from "@/lib/cfe/compute";
import { capabilitiesFor } from "./permissions";
import { recordUpload } from "./store";

const MAX_BYTES = 4 * 1024 * 1024; // TECH_SPEC §5

/** Upload → validate → save as a Final version (or keep as a failed upload). Problems with
 *  the file itself (wrong type, too large, empty) come back as a message and nothing is
 *  stored. Shared by the upload form's two paths (with progress, and the no-script form). */
export async function processUpload(admin: Admin, file: FormDataEntryValue | null): Promise<{ id: string } | { error: string }> {
  if (!capabilitiesFor(admin).has("upload")) return { error: "Your account can’t upload workbooks." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a workbook to upload." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Upload an Excel workbook (.xlsx). Older .xls files and CSVs aren’t supported." };
  if (file.size > MAX_BYTES) return { error: `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 4 MB. Remove embedded images or unused sheets and try again.` };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== "PK") return { error: "This file isn’t a valid .xlsx workbook. Open it in Excel, save it as .xlsx and upload it again." };

  const { wb, issues } = await readWorkbook(buf);
  const result = wb ? validate(wb) : { framework: null, validation: { passed: false, errors: issues, warnings: [] } };
  const asOf = result.framework?.meta.as_of ?? (wb && /^\d{4}-\d{2}$/.test(wb.meta.as_of?.value ?? "") ? wb.meta.as_of.value : "");
  const record = await recordUpload({
    admin, filename: file.name, file: buf, asOf, validation: result.validation,
    framework: result.framework, payload: result.framework ? toPayload(result.framework) : null,
  });
  return { id: record.id };
}
