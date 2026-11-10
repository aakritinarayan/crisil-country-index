"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import { ChevronDown, Search } from "@/components/ui/icons";
import { ScoreChip } from "../ScoreChip";
import { useExplorer, type SummaryCountry } from "./ExplorerContext";

const PAGE = 25;
type SortKey = "rank" | "name" | string; // string = pillar_id
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Rankings() {
  const { summary, openScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const bands = allBands(meta.score_bands);
  const [q, setQ] = useState("");
  const [band, setBand] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const n = norm(q.trim());
    const val = (c: SummaryCountry): number | string =>
      sort.key === "rank" ? c.rank : sort.key === "name" ? c.name : c.scores[sort.key] ?? -1;
    return countries
      .filter((c) => !n || norm(c.name).includes(n) || c.iso_code.toLowerCase() === n)
      .filter((c) => band === "all" || (c.composite_score != null && String(bandFor(c.composite_score, meta.score_bands).index) === band))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        const r = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
        // scores sort high→low first; rank and name low→high first
        return (sort.key === "rank" || sort.key === "name" ? r : -r) * sort.dir || a.rank - b.rank;
      });
  }, [countries, q, band, sort, meta.score_bands]);

  const filtered = q.trim() !== "" || band !== "all";
  const visible = showAll || filtered ? rows : rows.slice(0, PAGE);
  const setSortKey = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? ((sort.key === "rank" || sort.key === "name") === (sort.dir === 1) ? "ascending" : "descending") : undefined);

  const SortHead = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={ariaSort(k)} className={`px-2 pb-3 align-bottom text-left text-[13px] font-semibold text-ink-2 ${className}`}>
      <button type="button" onClick={() => setSortKey(k)} className="group inline-flex items-end gap-1 text-left hover:text-ink">
        <span>{children}</span>
        <ChevronDown size={14} className={`mb-0.5 shrink-0 transition-transform ${sort.key === k ? "text-ink" : "text-transparent group-hover:text-muted"} ${sort.key === k && ariaSort(k) === "ascending" && k !== "rank" && k !== "name" ? "rotate-180" : ""} ${sort.key === k && ariaSort(k) === "descending" && (k === "rank" || k === "name") ? "rotate-180" : ""}`} />
      </button>
    </th>
  );

  return (
    <section id="rankings" aria-labelledby="rankings-h" className="wrap scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Rankings</span>
          <h2 id="rankings-h" className="t-h2 mt-4">Every country, <span className="grad-text">every pillar</span></h2>
          <p className="mt-3 max-w-[60ch] text-muted">Sort by any column. Select a score to read why it was given and the sources behind it.</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-3 border border-line-strong bg-raised px-4 focus-within:outline-3 focus-within:outline-focus sm:max-w-sm">
          <Search className="text-muted" /><span className="sr-only">Filter countries</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by country" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Composite band</span>
          <select value={band} onChange={(e) => setBand(e.target.value)} className="h-11 flex-1 border border-line-strong bg-raised px-3 text-[15px] text-ink">
            <option value="all">All bands</option>
            {bands.map((b) => <option key={b.label} value={String(b.index)}>{b.label} ({b.min}–{b.max})</option>)}
          </select>
        </label>
        <p className="self-center text-sm text-muted sm:ml-auto num" aria-live="polite">{rows.length} of {countries.length} countries</p>
      </div>

      {rows.length === 0 && <p className="mt-8 border border-dashed border-line-strong p-8 text-center text-muted">No countries match. Clear the filter to see all {countries.length}.</p>}

      {/* desktop / tablet: table */}
      {rows.length > 0 && (
        <div className="mt-6 hidden overflow-x-auto md:block lg:overflow-visible">
          <table className="w-full border-collapse">
            <caption className="sr-only">{meta.index_name}: scores by country and pillar</caption>
            <thead className="z-10 bg-bg lg:sticky lg:top-16">
              <tr className="border-b border-line-strong">
                <SortHead k="rank" className="w-14">#</SortHead>
                <SortHead k="name">Country</SortHead>
                {pillars.map((p) => <SortHead key={p.pillar_id} k={p.pillar_id} className="min-w-[124px]">{p.name}</SortHead>)}
                {meta.show_composite && <SortHead k="rank" className="min-w-[132px] text-right">Composite</SortHead>}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.country_id} className="group border-b border-line hover:bg-raised">
                  <td className="px-2 py-2.5 text-sm text-muted num">{c.rank}</td>
                  <th scope="row" className="px-2 py-2.5 text-left font-semibold">
                    <Link href={`/country/${c.slug}`} className="text-ink hover:text-link hover:underline hover:underline-offset-4">{c.name}</Link>
                  </th>
                  {pillars.map((p) => {
                    const v = c.scores[p.pillar_id];
                    const b = bandFor(v, meta.score_bands);
                    return (
                      <td key={p.pillar_id} className="px-1 py-1.5">
                        <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)}
                          aria-label={`${c.name}, ${p.name}: ${fmtScore(v)}, ${b.label}. Open rationale and sources`}
                          className="flex w-full items-baseline gap-1.5 px-2 py-1.5 text-left hover:bg-sunken hover:ring-1 hover:ring-line-strong">
                          <span className="inline-block size-2.5 shrink-0 self-center rounded-full" style={{ background: b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .12)" }} aria-hidden />
                          <span className="text-[15px] font-semibold text-ink num">{fmtScore(v)}</span>
                          <span className="truncate text-xs text-muted">{b.label}</span>
                        </button>
                      </td>
                    );
                  })}
                  {meta.show_composite && c.composite_score != null && (
                    <td className="px-2 py-2.5 text-right"><ScoreChip score={c.composite_score} bands={meta.score_bands} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* phone: ranked list, tap to expand pillars */}
      {rows.length > 0 && (
        <ol className="mt-6 grid gap-2 md:hidden">
          {visible.map((c) => {
            const isOpen = open === c.country_id;
            return (
              <li key={c.country_id} className="border border-line bg-raised">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.country_id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="w-8 text-sm text-muted num">#{c.rank}</span>
                  <span className="flex-1 font-semibold text-ink">{c.name}</span>
                  {c.composite_score != null && <ScoreChip score={c.composite_score} bands={meta.score_bands} size="sm" />}
                  <ChevronDown size={16} className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-line px-4 pb-4 pt-2">
                    <ul>
                      {pillars.map((p) => {
                        const v = c.scores[p.pillar_id];
                        return (
                          <li key={p.pillar_id} className="border-b border-line last:border-0">
                            <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                              <span className="text-sm text-ink-2">{p.name}</span><ScoreChip score={v} bands={meta.score_bands} size="sm" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <Link href={`/country/${c.slug}`} className="mt-3 inline-block text-sm font-semibold text-link underline underline-offset-4">Open {c.name} profile</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!filtered && rows.length > PAGE && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-outline">
            {showAll ? `Show top ${PAGE} only` : `Show all ${rows.length} countries`}<span className="box"><ChevronDown size={16} className={showAll ? "rotate-180" : ""} /></span>
          </button>
        </div>
      )}
    </section>
  );
}
