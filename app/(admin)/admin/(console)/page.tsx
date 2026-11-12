import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getPublishedSnapshot } from "@/lib/data";
import { formatAsOf } from "@/lib/bands";
import { ArrowUpRight } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Overview · Admin" };

/* Admin overview. Phase 1 of the admin build: what the public site is serving now. The
 * version history, upload and publish arrive with the local data store (phases 2–4). */
export default function AdminOverview() {
  return (
    <>
      <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.025em] text-ink">Overview</h1>
      <p className="mt-1.5 text-[15px] text-muted">The data behind the public Country Index.</p>
      <Suspense fallback={<div className="admin-card mt-8 h-[220px]" />}><Live /></Suspense>
    </>
  );
}

async function Live() {
  await requireAdmin(); // authorisation on the server, not only in middleware
  const p = await getPublishedSnapshot();
  const sample = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";

  return (
    <>
      <section aria-labelledby="live-h" className="admin-card mt-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="live-h" className="text-[17px] font-semibold text-ink">Live on the public site</h2>
            <p className="mt-0.5 text-[13.5px] text-muted">{p ? p.meta.index_name : "Nothing is published yet."}</p>
          </div>
          {p && <span className="admin-status is-live"><span aria-hidden className="dot" />Live</span>}
        </div>
        {p && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:px-6 md:grid-cols-4">
            <Stat label="Reporting period" value={formatAsOf(p.meta.as_of)} />
            <Stat label="Countries" value={String(p.countries.length)} />
            <Stat label="Pillars" value={String(p.pillars.length)} />
            <Stat label="Composite score" value={p.meta.show_composite ? "Shown" : "Hidden"} />
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[13.5px] sm:px-6">
          <span className="text-muted">Source: the sample dataset bundled with the site{sample ? " · sample-data notice on" : ""}</span>
          <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-link inline-flex items-center gap-1 font-semibold">
            View public site<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="versions-h" className="mt-10">
        <h2 id="versions-h" className="text-[20px] font-semibold tracking-[-0.015em] text-ink">Versions</h2>
        <p className="mt-1 text-[14px] text-muted">Every uploaded workbook, its validation result, and who published it.</p>
        <div className="admin-card mt-4 px-5 py-10 text-center sm:px-6">
          <p className="text-[15px] font-semibold text-ink">No workbook uploads yet</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[14px] leading-relaxed text-muted">Uploading, validation, preview and publishing are being added next. Until then the site serves the bundled sample dataset.</p>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="mt-1 text-[20px] font-semibold tracking-[-0.01em] text-ink num">{value}</dd>
    </div>
  );
}
