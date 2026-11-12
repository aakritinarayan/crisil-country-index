import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { dataSource, latestFramework } from "@/lib/admin/store";
import { capabilitiesFor } from "@/lib/admin/permissions";
import { workflowSettings } from "@/lib/admin/workflow";
import { fmtPeriod } from "@/lib/admin/format";
import { PageHead } from "@/components/admin/Page";
import { Download } from "@/components/ui/icons";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = { title: "Upload data · Admin" };

// the agreed workflow (lib/admin/workflow.ts); the approval step shows only while it's required
const steps = (approval: boolean) => [
  ["Download the template", "It comes filled with the current data. Bring in the month’s finalised scores, rationale and sources; keep the headers as they are."],
  ["Upload the final workbook", "Only a workbook finalised internally. It’s checked automatically: errors stop it and say exactly where to fix; warnings are listed but don’t block it."],
  ["Review changes", "It’s saved as a Final version with a summary of what changed since the live one. Preview it as the public site."],
  ...(approval ? [["Approval", "Another administrator reviews and approves it. The uploader can’t approve their own workbook."] as const] : []),
  ["Publish", "After a confirmation it replaces the live version. Until then the public site doesn’t change."],
] as const;

export default function UploadPage() {
  return (
    <>
      <PageHead title="Upload data" description="Upload the finalised monthly assessment workbook. Nothing reaches the public site until it’s validated, reviewed and published." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section aria-labelledby="up-h" className="admin-card p-5 sm:p-6">
          <h2 id="up-h" className="sr-only">Workbook</h2>
          <Suspense fallback={<div className="drop-zone h-[180px]" />}><Upload /></Suspense>
        </section>
        <section aria-labelledby="how-h" className="admin-card p-5">
          <h2 id="how-h" className="text-[15px] font-semibold text-ink">How an update goes live</h2>
          <Suspense fallback={<div className="mt-3 h-[260px]" />}><Steps /></Suspense>
        </section>
      </div>
    </>
  );
}

/** Read at request time, so a change to the approval setting shows without a rebuild. */
async function Steps() {
  await connection();
  return (
    <ol className="mt-3 grid gap-3.5">
      {steps(workflowSettings().approvalRequired).map(([t, d], i) => (
        <li key={t} className="flex gap-3">
          <span aria-hidden className="step-num">{i + 1}</span>
          <span className="min-w-0"><span className="block text-[14px] font-semibold text-ink">{t}</span><span className="block text-[13px] leading-relaxed text-muted">{d}</span></span>
        </li>
      ))}
    </ol>
  );
}

async function Upload() {
  const admin = await requireAdmin();
  if (dataSource() === "demo") {
    return <p className="text-[14.5px] text-muted">The console is showing demonstration records (ADMIN_DEMO_DATA=true), which are read-only. Turn them off to upload real workbooks.</p>;
  }
  if (!capabilitiesFor(admin).has("upload")) return <p className="text-[14.5px] text-muted">Your account can’t upload workbooks.</p>;
  const f = await latestFramework();
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink">Start from the template</p>
          <p className="text-[13.5px] text-muted">{f ? `Pre-filled with the current data (${fmtPeriod(f.meta.as_of)}).` : "With the tabs and headers the upload expects."}</p>
        </div>
        <a href="/admin/upload/template" download className="act-btn"><Download size={16} />Download template</a>
      </div>
      <UploadForm />
    </>
  );
}
