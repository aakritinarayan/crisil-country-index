"use client";
import { Fragment, useMemo, useState } from "react";
import { bandFor, fmtScore } from "@/lib/bands";
import { ChevronDown, Search } from "@/components/ui/icons";
import { ScoreChip } from "../ScoreChip";
import { COMPOSITE, useExplorer, type SummaryCountry } from "./ExplorerContext";

const PAGE = 25;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Bring the map + panel into view after choosing a country from the list. */
function revealMap() {
  const el = document.getElementById("map");
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top >= 0 && r.top < window.innerHeight * 0.5) return;
  el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/** Compact, searchable, sortable grid of every country. Selection, the active measure
 *  and the band filter are shared with the map (ExplorerContext); only the text query,
 *  sort column and "show all" are local to the list. */
export function Rankings() {
  const { summary, selectedId, select, measure, measureLabel, valueOf, rankOf, passesFilter, bandFilter, openScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const [q, setQ] = useState("");
  // null = follow the measure chosen above the map
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sortKey = sort?.key ?? measure;
  const dir = sort?.dir ?? 1;

  const rows = useMemo(() => {
    const n = norm(q.trim());
    const val = (c: SummaryCountry): number | string | null =>
      sortKey === "name" ? c.name : sortKey === COMPOSITE ? c.composite_score : c.scores[sortKey] ?? null;
    return countries
      .filter((c) => !n || norm(c.name).includes(n) || c.iso_code.toLowerCase() === n)
      .filter(passesFilter)
      .sort((a, b) => {
        const x = val(a), y = val(b);
        if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * dir;
        return ((y ?? -Infinity) - (x ?? -Infinity)) * dir || a.name.localeCompare(b.name); // high → low first
      });
  }, [countries, q, passesFilter, sortKey, dir]);

  const narrowed = q.trim() !== "" || !!bandFilter;
  const head = showAll || narrowed ? rows : rows.slice(0, PAGE);
  // keep the selected country visible even when it sits below the first page
  const pinned = selectedId && !head.some((c) => c.country_id === selectedId) ? rows.find((c) => c.country_id === selectedId) : undefined;

  const choose = (id: string) => { select(id); revealMap(); };
  const setSortKey = (key: string) => setSort((s) => ({ key, dir: (s?.key ?? measure) === key ? (((s?.dir ?? 1) * -1) as 1 | -1) : 1 }));
  const ariaSort = (key: string): "ascending" | "descending" | undefined =>
    sortKey !== key ? undefined : (key === "name") === (dir === 1) ? "ascending" : "descending";

  const columns = [
    ...pillars.map((p) => ({ key: p.pillar_id, label: p.name })),
    ...(meta.show_composite ? [{ key: COMPOSITE, label: "Composite" }] : []),
  ];

  const renderRow = (c: SummaryCountry) => {
    const sel = c.country_id === selectedId;
    return (
      <tr key={c.country_id} className={`border-b border-line ${sel ? "bg-sunken" : "hover:bg-raised"}`}>
        <td className={`w-12 border-l-[3px] py-1.5 pl-2 text-[13px] text-muted num ${sel ? "border-l-[var(--brand)]" : "border-l-transparent"}`}>{rankOf(c.country_id) || "–"}</td>
        <th scope="row" className="py-1.5 pr-2 text-left font-normal">
          <button type="button" onClick={() => choose(c.country_id)} aria-pressed={sel} aria-label={`${c.name}: show on map`}
            className={`text-left text-[14.5px] hover:text-link hover:underline hover:underline-offset-4 ${sel ? "font-bold text-ink" : "font-semibold text-ink"}`}>
            {c.name}
          </button>
        </th>
        {columns.map((col) => {
          const v = col.key === COMPOSITE ? c.composite_score : c.scores[col.key];
          if (v == null) return <td key={col.key} className="px-1 text-muted">–</td>;
          const b = bandFor(v, meta.score_bands);
          const active = col.key === measure;
          if (col.key === COMPOSITE) return <td key={col.key} className={`px-2 py-1 text-right ${active ? "bg-sunken/70" : ""}`}><ScoreChip score={v} bands={meta.score_bands} size="sm" /></td>;
          return (
            <td key={col.key} className={`px-0.5 py-0.5 ${active ? "bg-sunken/70" : ""}`}>
              <button type="button" onClick={(e) => openScore(c.country_id, col.key, e.currentTarget)}
                aria-label={`${c.name}, ${col.label}: ${fmtScore(v)}, ${b.label}. Open rationale and sources`}
                className="flex w-full items-center gap-1.5 px-1.5 py-1 text-left hover:bg-bg hover:ring-1 hover:ring-line-strong">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .14)" }} aria-hidden />
                <span className="text-[14px] font-semibold text-ink num">{fmtScore(v)}</span>
                <span className="truncate text-[11.5px] text-muted">{b.label}</span>
              </button>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <section id="rankings" aria-labelledby="rankings-h" className="wrap scroll-mt-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="eyebrow">Rankings</span>
          <h2 id="rankings-h" className="t-h2 mt-4">Every country, <span className="grad-text">every pillar</span></h2>
          <p className="mt-3 max-w-[60ch] text-muted">Ranked on <span className="font-semibold text-ink-2">{measureLabel.toLowerCase()}</span>. Select a country to show it on the map, or a score for its rationale and sources.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
          <label className="flex h-10 items-center gap-2.5 border border-line-strong bg-raised px-3 focus-within:outline-3 focus-within:outline-focus sm:w-64">
            <Search size={17} className="shrink-0 text-muted" /><span className="sr-only">Filter the rankings</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by country" className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <p className="text-[13px] text-muted num" aria-live="polite">{rows.length} of {countries.length}{bandFilter && " · band filter on"}</p>
        </div>
      </div>

      {rows.length === 0 && <p className="mt-6 border border-dashed border-line-strong p-8 text-center text-muted">No countries match. Clear the filter or the band selection above the map.</p>}

      {rows.length > 0 && (
        <div className="mt-6 hidden overflow-x-auto md:block lg:overflow-visible">
          <table className="w-full border-collapse">
            <caption className="sr-only">{meta.index_name}: scores by country and pillar, ranked on {measureLabel}</caption>
            <thead className="z-10 bg-bg lg:sticky lg:top-16">
              <tr className="border-b border-line-strong">
                <th scope="col" className="w-12 pb-2 pl-2 text-left text-[12px] font-semibold text-muted">#</th>
                <th scope="col" aria-sort={ariaSort("name")} className="pb-2 text-left">
                  <SortButton active={sortKey === "name"} flipped={ariaSort("name") === "descending"} onClick={() => setSortKey("name")}>Country</SortButton>
                </th>
                {columns.map((col) => (
                  <th key={col.key} scope="col" aria-sort={ariaSort(col.key)} className={`px-1.5 pb-2 align-bottom ${col.key === COMPOSITE ? "text-right" : "text-left"} ${col.key === measure ? "bg-sunken/70" : ""}`}>
                    <SortButton active={sortKey === col.key} flipped={ariaSort(col.key) === "ascending"} onClick={() => setSortKey(col.key)}>{col.label}</SortButton>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {head.map(renderRow)}
              {pinned && (
                <Fragment>
                  <tr aria-hidden><td colSpan={columns.length + 2} className="py-1 text-center text-xs text-muted">· · ·</td></tr>
                  {renderRow(pinned)}
                </Fragment>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* phone: compact ranked list on the active measure */}
      {rows.length > 0 && (
        <ol className="mt-5 grid border-t border-line md:hidden">
          {[...head, ...(pinned ? [pinned] : [])].map((c) => {
            const sel = c.country_id === selectedId;
            const open = expanded === c.country_id;
            const v = valueOf(c);
            return (
              <li key={c.country_id} className={`border-b border-line ${sel ? "bg-sunken" : ""}`}>
                <div className={`flex items-center gap-2 border-l-[3px] py-2 pl-2 pr-1 ${sel ? "border-l-[var(--brand)]" : "border-l-transparent"}`}>
                  <span className="w-8 shrink-0 text-[13px] text-muted num">#{rankOf(c.country_id) || "–"}</span>
                  <button type="button" onClick={() => choose(c.country_id)} aria-pressed={sel} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-ink">{c.name}</button>
                  {v != null && <ScoreChip score={v} bands={meta.score_bands} size="sm" />}
                  <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${c.name} pillar scores`} onClick={() => setExpanded(open ? null : c.country_id)} className="grid size-9 shrink-0 place-items-center text-muted">
                    <ChevronDown size={16} className={open ? "rotate-180" : ""} />
                  </button>
                </div>
                {open && (
                  <ul className="px-3 pb-3">
                    {pillars.map((p) => (
                      <li key={p.pillar_id}>
                        <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)} className="flex w-full items-center justify-between gap-3 border-t border-line py-2 text-left">
                          <span className="min-w-0 truncate text-[13.5px] text-ink-2">{p.name}</span><ScoreChip score={c.scores[p.pillar_id]} bands={meta.score_bands} size="sm" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!narrowed && rows.length > PAGE && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-outline">
            {showAll ? `Show top ${PAGE} only` : `Show all ${rows.length} countries`}<span className="box"><ChevronDown size={16} className={showAll ? "rotate-180" : ""} /></span>
          </button>
        </div>
      )}
    </section>
  );
}

function SortButton({ active, flipped, onClick, children }: { active: boolean; flipped: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`group inline-flex items-end gap-1 text-left text-[12.5px] font-semibold leading-tight hover:text-ink ${active ? "text-ink" : "text-ink-2"}`}>
      <span>{children}</span>
      <ChevronDown size={13} className={`mb-px shrink-0 ${active ? "text-ink" : "text-transparent group-hover:text-muted"} ${flipped ? "rotate-180" : ""}`} />
    </button>
  );
}
