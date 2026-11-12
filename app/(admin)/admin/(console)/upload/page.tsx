import type { Metadata } from "next";
import { PageHead } from "@/components/admin/Page";
import { FileSheet } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Upload data · Admin" };

/* Upload: the route and its explanation exist; the upload itself (store the file,
 * validate, save a draft) is the next build step. Said plainly on the page. */
const STEPS = [
  ["Upload", "Choose the monthly workbook (.xlsx) built from the Country Index template."],
  ["Validate", "Every tab, row and column is checked. Errors name the tab, row and column; dead reference links are warnings and don’t block publishing."],
  ["Review", "A draft is saved with a summary of what changed since the live version. Preview it as the public site."],
  ["Publish", "Publishing replaces the live version after a confirmation. Earlier versions stay available to restore."],
] as const;

export default function UploadPage() {
  return (
    <>
      <PageHead title="Upload data" description="Upload the monthly assessment workbook. Nothing reaches the public site until someone publishes it." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section aria-labelledby="up-h" className="admin-card p-5 sm:p-6">
          <h2 id="up-h" className="sr-only">Workbook</h2>
          <div className="drop-zone" aria-disabled="true">
            <FileSheet size={28} />
            <p className="mt-3 text-[15px] font-semibold text-ink">Workbook upload isn’t connected yet</p>
            <p className="mx-auto mt-1 max-w-[52ch] text-[14px] leading-relaxed text-muted">This prototype doesn’t store files. In the next build step, choosing an .xlsx here validates it and saves a draft for review.</p>
            <p className="mt-4 text-[12.5px] text-muted">.xlsx from the Country Index template · up to 4 MB</p>
          </div>
        </section>
        <section aria-labelledby="how-h" className="admin-card p-5">
          <h2 id="how-h" className="text-[15px] font-semibold text-ink">How an update goes live</h2>
          <ol className="mt-3 grid gap-3.5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="step-num">{i + 1}</span>
                <span className="min-w-0"><span className="block text-[14px] font-semibold text-ink">{t}</span><span className="block text-[13px] leading-relaxed text-muted">{d}</span></span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
