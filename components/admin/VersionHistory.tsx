"use client";
import { useMemo, useState } from "react";
import { Close, Search } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { displayStatus } from "@/lib/admin/workflow";
import { VersionTable, type Row } from "./VersionTable";

/* Version history with a search and filters, all on the records already loaded — instant,
 * so no loading states. Statuses are the console's own (Live, Final, Archived); an upload
 * that failed validation has none and is found through search or "All statuses". */

type Status = "live" | "final" | "archived";
const STATUS_LABEL: Record<Status, string> = { live: "Live", final: "Final", archived: "Archived" };
const statusOf = (r: Row): Status | null => (r.v.status === "archived" ? "archived" : displayStatus(r.v));

/** What a search matches, predictably:
 *   "4", "v4", "version 4"  → that version number, exactly
 *   anything else           → the phrase, in the workbook's filename or in the name or email
 *                             of an administrator who uploaded, approved or published it,
 *                             or the start of the record ID */
function matcher(query: string): (r: Row) => boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return () => true;
  const n = q.match(/^(?:version ?|v)?(\d+)$/);
  if (n) return ({ v }) => v.version === Number(n[1]);
  return ({ v }) => {
    const people = [v.created_by, v.approved_by, v.published_by].flatMap((a) => (a && a.kind === "admin" ? [a.name, a.email] : []));
    return [v.source_file.filename, ...people].some((t) => t?.toLowerCase().includes(q)) || v.id.toLowerCase().startsWith(q);
  };
}

export function VersionHistory({ rows, zone }: { rows: Row[]; zone: string }) {
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("all");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const periods = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (/^\d{4}-\d{2}$/.test(r.v.as_of)) seen.set(r.v.as_of, r.period);
    return [...seen].sort((a, b) => b[0].localeCompare(a[0])); // newest period first
  }, [rows]);
  const shown = rows
    .filter(matcher(q))
    .filter((r) => period === "all" || r.v.as_of === period)
    .filter((r) => status === "all" || statusOf(r) === status)
    .sort((a, b) => (sort === "newest" ? b.v.created_at.localeCompare(a.v.created_at) : a.v.created_at.localeCompare(b.v.created_at)));
  const filtered = !!q.trim() || period !== "all" || status !== "all";
  const clear = () => { setQ(""); setPeriod("all"); setStatus("all"); };
  const count = (s: Status) => rows.filter((r) => statusOf(r) === s).length;

  return (
    <>
      <div role="search" aria-label="Find versions" className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="field flex h-11 min-w-[240px] flex-[1_1_320px] items-center gap-2.5 bg-raised px-3">
          <Search size={16} className="shrink-0 text-muted" /><span className="sr-only">Search versions</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search versions, files or administrators"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted outline-none [&::-webkit-search-cancel-button]:hidden" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-[4px] text-muted hover:bg-sunken hover:text-ink"><Close size={14} /></button>}
        </label>
        <Select label="Period" value={period} onChange={setPeriod} active={period !== "all"} minMenuWidth={200} className="w-full sm:w-auto [&>span]:w-12 sm:[&>span]:w-auto [&>button]:sm:w-[176px] [&>button]:sm:flex-none"
          options={[{ value: "all", label: "All periods" }, ...periods.map(([value, label]) => ({ value, label }))]} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} active={status !== "all"} minMenuWidth={180} className="w-full sm:w-auto [&>span]:w-12 sm:[&>span]:w-auto [&>button]:sm:w-[140px] [&>button]:sm:flex-none"
          options={[{ value: "all", label: "All statuses" }, ...(["live", "final", "archived"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s], meta: String(count(s)), disabled: count(s) === 0 }))]} />
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as typeof sort)} minMenuWidth={180} className="w-full sm:w-auto [&>span]:w-12 sm:[&>span]:w-auto [&>button]:sm:w-[150px] [&>button]:sm:flex-none"
          options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
        <p role="status" aria-live="polite" className="num">Showing {shown.length} of {rows.length} version{rows.length === 1 ? "" : "s"}<span aria-hidden> · </span>uploaded times in {zone}</p>
        {filtered && <button type="button" onClick={clear} className="admin-link font-semibold">Clear filters</button>}
      </div>

      {shown.length
        ? <VersionTable caption={`Versions, ${sort === "newest" ? "newest" : "oldest"} first`} rows={shown} />
        : (
          <div className="admin-card flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[15px] font-semibold text-ink">No matching versions found.</p>
              <p className="mt-0.5 text-[14px] text-muted">Try another search or adjust your filters.</p>
            </div>
            <button type="button" onClick={clear} className="act-btn">Clear filters</button>
          </div>
        )}
    </>
  );
}
