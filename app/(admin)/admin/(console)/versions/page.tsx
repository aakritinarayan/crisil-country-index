import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dataSource, listVersions } from "@/lib/admin/store";
import { actionsFor, capabilitiesFor } from "@/lib/admin/permissions";
import { zoneName } from "@/lib/admin/format";
import { DemoNotice, PageHead, UploadButton } from "@/components/admin/Page";
import { VersionTable } from "@/components/admin/VersionTable";
import { ArrowRight } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Version history · Admin" };

export default function VersionsPage() {
  return (
    <>
      <PageHead title="Version history" description="Every uploaded workbook, newest first. Exactly one version is live at a time." action={<UploadButton />} />
      <Suspense fallback={<div className="admin-card h-[240px]" />}><Content /></Suspense>
    </>
  );
}

async function Content() {
  const admin = await requireAdmin();
  const source = dataSource();
  const caps = capabilitiesFor(admin);
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
  const n = versions.length;
  return (
    <>
      {source === "demo" && <DemoNotice />}
      <p className="mb-3 text-[13.5px] text-muted">{n} upload{n === 1 ? "" : "s"} · times in {zoneName()}</p>
      <VersionTable caption="All versions, newest first" rows={versions.map((v) => ({ v, actions: actionsFor(v, caps, source) }))} />
    </>
  );
}
