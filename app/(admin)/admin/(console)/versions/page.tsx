import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { actionContext, dataSource, demoMode, listVersions } from "@/lib/admin/store";
import { zoneName } from "@/lib/admin/format";
import { DemoNotice, PageHead, UploadButton } from "@/components/admin/Page";
import { VersionHistory } from "@/components/admin/VersionHistory";
import { tableRows } from "@/lib/admin/rows";
import { ArrowRight } from "@/components/ui/icons";
import { HistorySkeleton } from "@/components/admin/Skeletons";

export const metadata: Metadata = { title: "Version history · Admin" };

export default function VersionsPage() {
  return (
    <>
      <PageHead title="Version history" description="Every uploaded workbook. Exactly one version is live at a time. Earlier live versions are Archived; a new upload is Final until it’s published." action={<UploadButton />} />
      <Suspense fallback={<HistorySkeleton />}><Content /></Suspense>
    </>
  );
}

async function Content() {
  const admin = await requireAdmin();
  const source = dataSource();
  const versions = await listVersions();
  if (!versions.length) {
    return (
      <div className="admin-card flex flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[15px] font-semibold text-ink">No data uploaded yet</p>
          <p className="mt-0.5 text-[14px] text-muted">Upload the first monthly file to get started.</p>
        </div>
        <Link href="/admin/upload" className="act-btn is-primary">Upload workbook<ArrowRight size={15} /></Link>
      </div>
    );
  }
  const ctx = await actionContext(admin, versions);
  return (
    <>
      {demoMode() !== "off" && <DemoNotice merged={demoMode() === "merge"} />}
      <VersionHistory rows={tableRows(versions, admin, source, ctx)} zone={zoneName()} />
    </>
  );
}
