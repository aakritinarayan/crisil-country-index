"use client";
import { useActionState, useState } from "react";
import { FileSheet, UploadIcon } from "@/components/ui/icons";
import { uploadWorkbook } from "./actions";

/** Choose a workbook and upload it. Validation runs on the server; this only shows the
 *  chosen file and any problem with the file itself. */
export function UploadForm() {
  const [error, dispatch, pending] = useActionState(uploadWorkbook, null);
  const [name, setName] = useState<string | null>(null);
  return (
    <form action={dispatch} className="grid gap-4">
      <label className={`drop-zone is-live ${name ? "has-file" : ""}`}>
        <FileSheet size={28} />
        <span className="mt-3 text-[15px] font-semibold text-ink">{name ?? "Choose the workbook to upload"}</span>
        <span className="mt-1 text-[13.5px] text-muted">{name ? "Choose another file to replace it" : ".xlsx from the Country Index template · up to 4 MB"}</span>
        <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="sr-only"
          onChange={(e) => setName(e.currentTarget.files?.[0]?.name ?? null)} aria-describedby={error ? "upload-error" : undefined} />
      </label>
      {error && <p id="upload-error" role="alert" className="admin-error">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !name} className="act-btn is-primary !h-10 disabled:cursor-not-allowed disabled:opacity-50">
          <UploadIcon size={16} />{pending ? "Uploading and checking…" : "Upload and validate"}
        </button>
        <span className="text-[13px] text-muted">Nothing changes on the public site until a version is published.</span>
      </div>
    </form>
  );
}
