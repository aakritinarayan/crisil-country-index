import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { actionContext, dataSource, getVersion, listVersions } from "@/lib/admin/store";
import { actionsFor, capabilitiesFor } from "@/lib/admin/permissions";
import { fmtBytes, fmtDateTime, fmtPeriod, zoneName } from "@/lib/admin/format";
import { awaitingApproval } from "@/lib/admin/workflow";
import { versionLabel, type AuditEvent, type ChangeSummary, type VersionRecord } from "@/lib/admin/types";
import { fmtScore } from "@/lib/bands";
import { DemoNotice, PageHead } from "@/components/admin/Page";
import { ActionButton } from "@/components/admin/ActionButton";
import { PublishControl } from "@/components/admin/PublishControl";
import { ActorLabel, StatusLabel, ValidationLabel, actorName } from "@/components/admin/Status";
import { Check, Download, Eye, Publish, Restore } from "@/components/ui/icons";
import { nCountries } from "@/lib/plural";

export const metadata: Metadata = { title: "Version details · Admin" };

export default function VersionPage({ params, searchParams }: PageProps<"/admin/versions/[id]">) {
  return <Suspense fallback={<div className="admin-card h-[320px]" />}><Detail params={params} searchParams={searchParams} /></Suspense>;
}

async function Detail({ params, searchParams }: { params: PageProps<"/admin/versions/[id]">["params"]; searchParams: PageProps<"/admin/versions/[id]">["searchParams"] }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flash = await searchParams;
  const found = await getVersion(id);
  if (!found) notFound();
  const { version: v, events } = found;
  const source = dataSource();
  const ctx = await actionContext(admin, await listVersions());
  const a = actionsFor(v, capabilitiesFor(admin), source, ctx);
  const live = ctx.live && ctx.live.id !== v.id ? ctx.live : null;
  const local = source === "local";
  const title = `${versionLabel(v)} (${fmtPeriod(v.as_of)})`;
  const changeLine = v.changes ? summaryLine(v.changes) : null;

  return (
    <>
      <PageHead
        back={{ href: "/admin/versions", label: "Version history" }}
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{versionLabel(v)}<span className="text-[0.62em] font-normal tracking-normal"><StatusLabel v={v} /></span></span>}
        description={`${fmtPeriod(v.as_of)} · uploaded ${fmtDateTime(v.created_at)} by ${actorName(v.created_by)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ActionButton state={a.preview} label="Preview" icon={Eye} href={`/admin/preview/${v.id}`} newTab reasonId="a-preview" />
            {a.approve && (a.approve.enabled
              ? <PublishControl id={v.id} mode="approve" title={title} replaces={null} changes={null} local={local} />
              : <ActionButton state={a.approve} label="Approve…" icon={Check} tone="primary" reasonId="a-approve" />)}
            {a.publish && (a.publish.enabled
              ? <PublishControl id={v.id} mode={a.earlier ? "republish" : "publish"} title={title} replaces={live ? `${versionLabel(live)} (${fmtPeriod(live.as_of)})` : null} changes={changeLine} local={local} />
              : <ActionButton state={a.publish} label={a.earlier ? "Publish again…" : "Publish…"} icon={a.earlier ? Restore : Publish} tone={a.earlier || a.approve ? "quiet" : "primary"} reasonId="a-publish" />)}
            <ActionButton state={a.download} label="Download" icon={Download} href={`/admin/versions/${v.id}/download`} download reasonId="a-download" />
          </div>
        }
      />
      {source === "demo" && <DemoNotice />}
      {flash.uploaded && (
        <p role="status" className={`flash mb-7 ${v.validation.passed ? "" : "is-bad"}`}>
          {v.validation.passed
            ? <>Uploaded and saved as <strong>{versionLabel(v)}</strong> (Final). {v.validation.warnings.length ? `Check the ${v.validation.warnings.length} warning${v.validation.warnings.length === 1 ? "" : "s"} below, ` : ""}review the changes, then {awaitingApproval(v, ctx.settings) ? "another administrator approves it before it can be published" : "preview or publish it"}. The public site hasn’t changed.</>
            : <>This upload didn’t pass validation, so nothing was saved as publishable. Fix the {v.validation.errors.length} error{v.validation.errors.length === 1 ? "" : "s"} below in the workbook and upload it again. The file is kept for reference.</>}
        </p>
      )}
      {flash.approved && v.approved_by && <p role="status" className="flash mb-7"><strong>{versionLabel(v)}</strong> is approved{local ? " (recorded in the local prototype store)" : ""}. It isn’t live until someone publishes it.</p>}
      {flash.published && v.status === "published" && <p role="status" className="flash mb-7"><strong>{versionLabel(v)}</strong> is now live on {local ? "the public site served from this machine (local prototype — not a production publish)" : "the public site"}.</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid min-w-0 gap-8">
          <Block id="val-h" title="Validation" aside={<ValidationLabel v={v.validation} long />}>
            <Issues v={v} />
          </Block>
          <Block id="chg-h" title="Change summary"><Changes v={v} /></Block>
          <Block id="act-h" title="Activity" aside={<span className="text-[12.5px] text-muted">Audit record · times in {zoneName()}</span>}>
            <Timeline events={events} />
          </Block>
        </div>
        <aside aria-labelledby="det-h" className="admin-card p-5">
          <h2 id="det-h" className="text-[15px] font-semibold text-ink">Details</h2>
          <dl className="det-list mt-3">
            <Row label="Version">{v.version != null ? v.version : <span className="text-muted">None — failed uploads aren’t versioned</span>}</Row>
            <Row label="Reporting period">{fmtPeriod(v.as_of)}</Row>
            <Row label="Status"><StatusLabel v={v} /></Row>
            <Row label="Source workbook"><span className="break-all">{v.source_file.filename}</span><span className="block text-[12.5px] text-muted">{fmtBytes(v.source_file.size_bytes)}</span></Row>
            <Row label="Uploaded"><span className="num">{fmtDateTime(v.created_at)}</span><ActorLabel actor={v.created_by} full /></Row>
            {(ctx.settings.approvalRequired || v.approved_by) && v.status !== "rejected" && (
              <Row label="Approved">{v.approved_at && v.approved_by ? <><span className="num">{fmtDateTime(v.approved_at)}</span><ActorLabel actor={v.approved_by} full /></> : <span className="text-muted">{v.status === "published" ? "Not recorded" : "Awaiting approval"}</span>}</Row>
            )}
            <Row label="Last published">{v.published_at && v.published_by ? <><span className="num">{fmtDateTime(v.published_at)}</span><ActorLabel actor={v.published_by} full /></> : <span className="text-muted">Not published</span>}</Row>
            {v.counts && <Row label="Contents">{nCountries(v.counts.countries)} · {v.counts.pillars} pillars</Row>}
            <Row label="Record ID"><span className="break-all font-mono text-[12px] text-muted">{v.id}</span></Row>
          </dl>
        </aside>
      </div>
    </>
  );
}

function Block({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>{aside}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function Issues({ v }: { v: VersionRecord }) {
  const list = [...v.validation.errors.map((i) => ({ ...i, kind: "Error" })), ...v.validation.warnings.map((i) => ({ ...i, kind: "Warning" }))];
  if (!list.length) return <p className="admin-card px-5 py-4 text-[14px] text-muted">Every tab, row and column passed. No warnings.</p>;
  return (
    <div className="admin-card overflow-x-auto">
      <table className="ver-table w-full text-[13.5px]">
        <caption className="sr-only">Validation issues</caption>
        <thead><tr><th scope="col">Type</th><th scope="col">Where</th><th scope="col">Issue</th></tr></thead>
        <tbody>
          {list.map((i, k) => (
            <tr key={k}>
              <td className={`whitespace-nowrap font-semibold ${i.kind === "Error" ? "text-[var(--danger)]" : "text-[var(--warn)]"}`}>{i.kind}</td>
              <td className="whitespace-nowrap text-ink-2 num">{[i.tab, i.row != null && `row ${i.row}`, i.column].filter(Boolean).join(" · ")}</td>
              <td className="min-w-[240px] text-ink-2">{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Changes({ v }: { v: VersionRecord }) {
  const c: ChangeSummary | null = v.changes;
  if (!c) {
    const why = v.status === "rejected" ? "Not available — the upload failed validation, so it was never compared." : "No comparison — nothing was live when this version was uploaded.";
    return <p className="admin-card px-5 py-4 text-[14px] text-muted">{why}</p>;
  }
  const parts = ([
    [c.scores_changed, "score changed", "scores changed"], [c.rationales_edited, "rationale edited", "rationales edited"],
    [c.sources_added, "source added", "sources added"], [c.sources_removed, "source removed", "sources removed"],
    [c.countries_added, "country added", "countries added"], [c.countries_removed, "country removed", "countries removed"],
  ] as const).filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return (
    <div className="admin-card">
      <p className="border-b border-line px-5 py-3.5 text-[14px] text-ink">
        {c.against_version != null && <span className="text-muted">Compared with version {c.against_version}: </span>}
        {parts.length ? parts.join(" · ") : "No changes"}
      </p>
      {c.largest_moves.length > 0 && (
        <table className="ver-table w-full text-[13.5px]">
          <caption className="px-5 pt-3 text-left text-[12.5px] text-muted">Largest score movements</caption>
          <thead><tr><th scope="col">Country</th><th scope="col">Pillar</th><th scope="col" className="!text-right">Score</th></tr></thead>
          <tbody>
            {c.largest_moves.map((m, k) => {
              const d = Math.round((m.after - m.before) * 10) / 10;
              return (
                <tr key={k}>
                  <td className="font-semibold text-ink">{m.country}</td>
                  <td className="text-ink-2">{m.pillar}</td>
                  <td className="whitespace-nowrap text-right text-ink num">{fmtScore(m.before)} → {fmtScore(m.after)} <span className="ml-1 text-muted">({d > 0 ? "+" : "−"}{fmtScore(Math.abs(d))})</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const EVENT_TEXT: Record<AuditEvent["type"], string> = {
  "upload.received": "Workbook uploaded",
  "validation.passed": "Validation passed",
  "validation.failed": "Validation failed",
  "draft.created": "Saved as Final",
  "version.approved": "Approved for publishing",
  "version.published": "Published",
  "version.restored": "Published again",
  "version.archived": "Replaced as live",
};

function detail(e: AuditEvent): string | null {
  const d = e.data ?? {};
  switch (e.type) {
    case "upload.received": return d.filename ? `${d.filename}${typeof d.size_bytes === "number" ? ` · ${fmtBytes(d.size_bytes)}` : ""}` : null;
    case "validation.passed": return d.warnings ? `${d.warnings} warning${d.warnings === 1 ? "" : "s"}` : "No warnings";
    case "validation.failed": return d.errors ? `${d.errors} error${d.errors === 1 ? "" : "s"} — nothing saved as publishable` : null;
    case "draft.created": return d.version != null ? `Saved as version ${d.version}` : null;
    case "version.approved": return "Ready to publish — publishing is a separate step";
    case "version.published": return d.replaced_version != null ? `Replaced version ${d.replaced_version} on the public site` : "First version on the public site";
    case "version.restored": return [d.replaced_version != null && `Replaced version ${d.replaced_version}`, d.note].filter(Boolean).join(" · ") || null;
    case "version.archived": return d.replaced_by_version != null ? `Superseded by version ${d.replaced_by_version}` : null;
  }
}

function Timeline({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <p className="admin-card px-5 py-4 text-[14px] text-muted">No activity has been recorded for this version.</p>;
  return (
    <div className="admin-card px-5 py-4">
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id} className={e.actor.kind === "system" ? "is-system" : ""}>
            <span aria-hidden className="tl-dot" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="text-[14px] font-semibold text-ink">{EVENT_TEXT[e.type]}</p>
              <time dateTime={e.at} className="text-[12.5px] text-muted num">{fmtDateTime(e.at)}</time>
            </div>
            <p className="text-[13px] text-ink-2">
              {e.actor.kind === "system" ? <span className="text-muted">System</span> : <>by {actorName(e.actor)}{e.actor.name && e.actor.email && <span className="break-all text-muted"> · {e.actor.email}</span>}</>}
            </p>
            {detail(e) && <p className="text-[13px] text-muted">{detail(e)}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-line pt-3 text-[12.5px] text-muted">Recorded events only; entries are never edited or removed. Opening a preview isn’t recorded.</p>
    </div>
  );
}

/** "Compared with version 3: 4 scores changed · 2 rationales edited" — for the confirmation. */
function summaryLine(c: ChangeSummary) {
  const parts = ([[c.scores_changed, "score changed", "scores changed"], [c.rationales_edited, "rationale edited", "rationales edited"],
    [c.sources_added, "source added", "sources added"], [c.sources_removed, "source removed", "sources removed"],
    [c.countries_added, "country added", "countries added"], [c.countries_removed, "country removed", "countries removed"]] as const)
    .filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return `${c.against_version != null ? `Compared with version ${c.against_version}: ` : ""}${parts.length ? parts.join(" · ") : "no changes"}`;
}
