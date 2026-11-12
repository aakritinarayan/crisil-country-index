import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getPublishedSnapshot } from "@/lib/data";
import { formatAsOf } from "@/lib/bands";
import { dataSource, overview } from "@/lib/admin/store";
import { actionsFor, capabilitiesFor } from "@/lib/admin/permissions";
import { fmtDate, fmtDateTime, fmtPeriod } from "@/lib/admin/format";
import { versionLabel } from "@/lib/admin/types";
import { DemoNotice, PageHead, SectionHead, UploadButton } from "@/components/admin/Page";
import { ActorLabel, StatusLabel, ValidationLabel, actorName } from "@/components/admin/Status";
import { VersionTable } from "@/components/admin/VersionTable";
import { ArrowRight, ArrowUpRight } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Overview · Admin" };

/* What is live, what is waiting, and the latest uploads — in that order. */
export default function AdminOverview() {
  return (
    <>
      <PageHead title="Overview" description="Manage the published Country Index and monthly assessment updates." action={<UploadButton />} />
      <Suspense fallback={<div className="admin-card h-[96px]" />}><Content /></Suspense>
    </>
  );
}

async function Content() {
  const admin = await requireAdmin(); // authorisation on the server, not only in middleware
  const source = dataSource();
  const caps = capabilitiesFor(admin);
  const { live, pending, recent, total } = await overview();

  return (
    <>
      {source === "demo" && <DemoNotice />}

      <section aria-labelledby="current-h">
        <SectionHead id="current-h" title="Current publication" />
        {live ? (
          <div className="admin-card pub-row">
            <Field label="Reporting period" value={fmtPeriod(live.as_of)} strong />
            <Field label="Version" value={<Link href={`/admin/versions/${live.id}`} className="ver-link">{versionLabel(live)}</Link>} />
            <Field label="Status" value={<StatusLabel status="published" />} />
            <Field label="Published" value={live.published_at ? fmtDate(live.published_at) : "—"} title={live.published_at ? fmtDateTime(live.published_at) : undefined} />
            <Field label="Published by" value={live.published_by ? <ActorLabel actor={live.published_by} compact /> : "—"} wide />
            <PublicLink />
          </div>
        ) : <Unpublished />}
      </section>

      {pending && (
        <section aria-labelledby="pending-h" className="mt-8">
          <SectionHead id="pending-h" title="Pending update" />
          <div className="pending-row">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{versionLabel(pending)} · {fmtPeriod(pending.as_of)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
                <ValidationLabel v={pending.validation} />
                <span>Uploaded by <span className="text-ink-2">{actorName(pending.created_by)}</span> on <span className="num">{fmtDate(pending.created_at)}</span></span>
              </p>
            </div>
            <Link href={`/admin/versions/${pending.id}`} className="act-btn is-primary shrink-0">Review changes<ArrowRight size={15} /></Link>
          </div>
        </section>
      )}

      <section aria-labelledby="recent-h" className="mt-10">
        <SectionHead id="recent-h" title="Recent versions">
          {total > recent.length && <Link href="/admin/versions" className="admin-link text-[13.5px] font-semibold">View all {total}</Link>}
        </SectionHead>
        {recent.length
          ? <VersionTable caption="Recent versions, newest first" rows={recent.map((v) => ({ v, actions: actionsFor(v, caps, source) }))} />
          : (
            <div className="admin-card flex flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[15px] font-semibold text-ink">No data uploaded yet</p>
                <p className="mt-0.5 text-[14px] text-muted">Upload the first monthly file to get started.</p>
              </div>
              <Link href="/admin/upload" className="act-btn is-primary">Upload workbook<ArrowRight size={15} /></Link>
            </div>
          )}
      </section>
    </>
  );
}

function Field({ label, value, strong = false, wide = false, title }: { label: string; value: React.ReactNode; strong?: boolean; wide?: boolean; title?: string }) {
  return (
    <div className={`min-w-0 ${wide ? "pub-wide" : ""}`}>
      <p className="text-[12px] text-muted">{label}</p>
      <div className={`mt-0.5 min-w-0 text-[14.5px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`} title={title}>{value}</div>
    </div>
  );
}

function PublicLink() {
  return (
    <Link href="/" target="_blank" rel="noopener noreferrer" className="act-btn pub-action">
      View public site<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

/** Nothing has been published through the admin: say what the site is actually showing. */
async function Unpublished() {
  const p = await getPublishedSnapshot();
  const sample = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";
  return (
    <div className="admin-card pub-row">
      <div className="pub-wide min-w-0">
        <p className="text-[14.5px] font-semibold text-ink">Nothing has been published from the admin yet</p>
        <p className="mt-0.5 text-[13.5px] text-muted">
          The public site shows the bundled sample dataset{p ? ` (${formatAsOf(p.meta.as_of)}, ${p.countries.length} countries, ${p.pillars.length} pillars)` : ""}{sample ? " with the sample-data notice" : ""}.
        </p>
      </div>
      <PublicLink />
    </div>
  );
}
