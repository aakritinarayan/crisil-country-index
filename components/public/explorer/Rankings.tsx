"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import { ChevronDown, Close, Search } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { COMPOSITE, useExplorer, type SummaryCountry } from "./ExplorerContext";

const PAGE = 25;
const SAVED = "rankings-ui"; // UI state kept for the trip to a country profile and back
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const letterOf = (name: string) => { const c = norm(name).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
type Mode = "ranked" | "az";
type Dir = "desc" | "asc";

/** Country rankings. Two ways to browse the same filtered set:
 *  Ranked — by the explorer's active measure (Composite or a pillar; clicking a column
 *    header changes it, so the map and the distribution follow), high → low or low → high.
 *    Ties share a rank (1, 1, 3) and are listed alphabetically; missing scores are never
 *    zero — they are unranked, listed last and marked "Not available".
 *  A–Z — by name, in letter groups, with a letter row that jumps anywhere in the list
 *    (rendering more rows first if needed). No rank numbers.
 *  Search (name or ISO code) and the band filter (on the active measure; shared with the
 *  map legend) work in both modes. Rows appear 25 at a time. Every score opens the
 *  rationale drawer; a country name opens its profile directly. Columns, bands and labels all come from the workbook. */
export function Rankings() {
  const { summary, selectedId, measure, setMeasure, measureLabel, valueOf, overview, bandFilter, setBands, openScore, activeScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const bands = allBands(meta.score_bands);
  const [mode, setMode] = useState<Mode>("ranked");
  const [dir, setDir] = useState<Dir>("desc");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const pendingJump = useRef<string | null>(null);
  const restoreY = useRef<number | null>(null);

  const columns = [
    ...pillars.map((p) => ({ key: p.pillar_id, label: p.name })),
    ...(meta.show_composite ? [{ key: COMPOSITE, label: "Composite" }] : []),
  ];
  const scoreOf = (c: SummaryCountry, key: string) => (key === COMPOSITE ? c.composite_score : c.scores[key] ?? null);
  const n = norm(q.trim());
  const searched = useMemo(() => countries.filter((c) => !n || norm(c.name).includes(n) || norm(c.iso_code).startsWith(n)), [countries, n]);

  // ranks on the active measure, over every country (never just the rows on screen)
  const ranks = useMemo(() => {
    const valid = countries.filter((c) => valueOf(c) != null).sort((a, b) => valueOf(b)! - valueOf(a)!);
    const m = new Map<string, number>();
    valid.forEach((c, i) => m.set(c.country_id, i > 0 && valueOf(valid[i - 1]) === valueOf(c) ? m.get(valid[i - 1].country_id)! : i + 1));
    return m;
  }, [countries, valueOf]);

  const filterBand = bandFilter;
  const rows = useMemo(() => {
    const list = searched.filter((c) => {
      if (!filterBand) return true;
      const v = valueOf(c);
      return v != null && filterBand.has(bandFor(v, meta.score_bands).index);
    });
    if (mode === "az") return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => {
      const x = valueOf(a), y = valueOf(b);
      if (x == null || y == null) return x == null && y == null ? a.name.localeCompare(b.name) : x == null ? 1 : -1; // missing last
      return (dir === "desc" ? y - x : x - y) || a.name.localeCompare(b.name);
    });
  }, [searched, filterBand, valueOf, meta.score_bands, mode, dir]);

  // how many rows are rendered: resets whenever what is being browsed changes
  const sig = `${mode}|${measure}|${dir}|${n}|${filterBand ? [...filterBand].join(",") : ""}`;
  const [win, setWin] = useState({ sig, count: PAGE });
  const limit = win.sig === sig ? win.count : PAGE;
  const setLimit = (count: number) => setWin({ sig, count });
  const shown = rows.slice(0, limit);
  const pinned = selectedId && !shown.some((c) => c.country_id === selectedId) ? rows.find((c) => c.country_id === selectedId) : undefined;

  const letters = useMemo(() => new Set(rows.map((c) => letterOf(c.name))), [rows]);
  const jumpTo = (L: string) => {
    const idx = rows.findIndex((c) => letterOf(c.name) === L);
    if (idx < 0) return;
    pendingJump.current = L;
    setActiveLetter(L);
    if (idx >= limit) setLimit(idx + PAGE); else scrollToLetter(L);
  };
  // smooth when the letter is already on the page; instant right after rendering more rows,
  // so the scroll is not fighting the new layout
  const scrollToLetter = (L: string, instant = false) => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-letter="${L}"]`)].find((e) => e.offsetParent !== null);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    pendingJump.current = null;
  };
  useEffect(() => { if (pendingJump.current) scrollToLetter(pendingJump.current, true); });

  // A–Z: the letter group at the top of the viewport is the active letter
  useEffect(() => {
    if (mode !== "az") return;
    const onScroll = () => {
      const heads = [...document.querySelectorAll<HTMLElement>("[data-letter]")].filter((e) => e.offsetParent !== null);
      let cur: string | null = null;
      for (const h of heads) if (h.getBoundingClientRect().top < 180) cur = h.dataset.letter ?? null;
      setActiveLetter(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  // back from a country profile: restore this section's own state and scroll position
  useEffect(() => {
    let saved: { mode: Mode; dir: Dir; q: string; count: number; y: number } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(SAVED) ?? "null"); sessionStorage.removeItem(SAVED); } catch { /* storage blocked */ }
    if (!saved) return;
    // one-off restore after hydration (the page itself stays static)
    /* eslint-disable react-hooks/set-state-in-effect */
    setMode(saved.mode); setDir(saved.dir); setQ(saved.q);
    setWin({ sig: `${saved.mode}|${measure}|${saved.dir}|${norm(saved.q.trim())}|${bandFilter ? [...bandFilter].join(",") : ""}`, count: saved.count });
    /* eslint-enable react-hooks/set-state-in-effect */
    restoreY.current = saved.y;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (restoreY.current != null) { const y = restoreY.current; restoreY.current = null; requestAnimationFrame(() => window.scrollTo(0, y)); } });
  const remember = () => { try { sessionStorage.setItem(SAVED, JSON.stringify({ mode, dir, q, count: limit, y: window.scrollY })); } catch { /* storage blocked */ } };
  const rememberRef = useRef(remember);
  useEffect(() => { rememberRef.current = remember; });
  useEffect(() => {
    const on = () => rememberRef.current(); // the score drawer's "View full country assessment"
    window.addEventListener("rankings:remember", on);
    return () => window.removeEventListener("rankings:remember", on);
  }, []);

  const sortBy = (key: string) => {
    if (mode === "az") setMode("ranked");
    if (key === measure && !overview) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setMeasure(key); setDir("desc"); }
  };
  const narrowed = !!n || !!filterBand;
  const clearAll = () => { setQ(""); setBands(null); };
  const singleBand = filterBand?.size === 1 ? [...filterBand][0] : null;
  const bandCounts = bands.map((b) => searched.filter((c) => { const v = valueOf(c); return v != null && bandFor(v, meta.score_bands).index === b.index; }).length);
  const rankLabel = measure === COMPOSITE ? "Composite" : measureLabel;
  const sortedCol = mode === "ranked" ? measure : null;

  const scoreCell = (c: SummaryCountry, key: string, label: string, composite = false) => {
    const v = scoreOf(c, key);
    if (v == null) return <span className="text-[12.5px] text-muted">Not available</span>;
    const b = bandFor(v, meta.score_bands);
    // a softly tinted chip: the number is the content, the band only tints it (named in
    // the shared legend above, in the hover title and in the accessible name)
    const chip = <ScoreChipCell value={fmtScore(v)} fill={b.fill} composite={composite} />;
    const hint = `${label}: ${fmtScore(v)} · ${b.label} (${b.min}–${b.max})`;
    if (key === COMPOSITE) return <span className="score-cell flex px-1 py-0.5" title={hint} aria-label={`${c.name}, composite score ${fmtScore(v)}, ${b.label} band`} role="img">{chip}</span>;
    return (
      <button type="button" onClick={(e) => openScore(c.country_id, key, e.currentTarget)} title={`${hint}. Select for rationale and sources`}
        aria-label={`${c.name}, ${label}: ${fmtScore(v)}, ${b.label} band. Open rationale and sources`}
        data-active={activeScore?.countryId === c.country_id && activeScore.pillarId === key ? "" : undefined}
        className="score-cell flex px-1 py-0.5">{chip}</button>
    );
  };

  const countryCell = (c: SummaryCountry) => (
    <span className="flex items-center gap-1.5">
      <Link href={`/country/${c.slug}`} onClick={remember} className="country-link text-[14.5px] font-medium leading-snug text-ink hover:text-link hover:underline hover:underline-offset-4">
        {c.name}<span aria-hidden className="country-arrow ml-1 text-muted">→</span>
      </Link>
    </span>
  );

  const renderRow = (c: SummaryCountry) => {
    const sel = c.country_id === selectedId;
    const r = ranks.get(c.country_id);
    return (
      <tr key={c.country_id} className={`rank-row group border-b border-line ${sel ? "is-selected" : ""}`}>
        {mode === "ranked" && <td className="sticky-col left-0 w-12 py-1.5 pr-2 text-right text-[13px] text-muted num">{r ?? "–"}</td>}
        <th scope="row" className={`sticky-col ${mode === "ranked" ? "left-12" : "left-0"} min-w-[180px] max-w-[240px] py-1.5 pl-3 pr-3 text-left font-normal`}>{countryCell(c)}</th>
        {columns.map((col) => (
          <td key={col.key} className={`px-1 py-1 ${col.key === COMPOSITE ? "composite-col" : ""} ${sortedCol === col.key ? "is-sorted" : ""}`}>
            {scoreCell(c, col.key, col.label, col.key === COMPOSITE)}
          </td>
        ))}
      </tr>
    );
  };

  const groupRow = (L: string) => (
    <tr key={`g-${L}`} aria-hidden="false">
      <th colSpan={columns.length + 1} scope="rowgroup" data-letter={L} className="az-head scroll-mt-32 border-b border-line pb-1.5 pt-5 pl-3 text-left text-[13px] font-semibold text-ink">{L}</th>
    </tr>
  );

  const ariaSort = (key: string): "ascending" | "descending" | undefined =>
    sortedCol !== key ? undefined : dir === "desc" ? "descending" : "ascending";

  return (
    <section id="rankings" aria-labelledby="rankings-h" className="wrap scroll-mt-20">
      <p className="eyebrow">Country rankings</p>
      <h2 id="rankings-h" tabIndex={-1} className="t-h2 mt-3 outline-none">Every country, <span className="grad-text">every pillar</span></h2>
      <p className="mt-4 max-w-[64ch] text-muted">
        Explore how countries perform across key assessment pillars. Sort rankings, find countries, or select a score to understand the evidence behind it.
      </p>
      <p className="mt-2 text-[13.5px] text-muted num">Scores range from {meta.score_min} to {meta.score_max} and are grouped into {WORDS[bands.length] ?? bands.length} readiness bands. Select a score to explore its rationale and sources.</p>

      {/* toolbar: browse mode · search · band · rank by · clear */}
      <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div role="radiogroup" aria-label="Browse" className="flex h-11 shrink-0 border border-line bg-raised p-[3px]">
          {(["ranked", "az"] as const).map((m) => (
            <label key={m} className="relative flex cursor-pointer">
              <input type="radio" name="rank-mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="peer sr-only" />
              <span className="flex items-center px-3.5 text-[13px] font-medium text-muted transition-colors hover:text-ink peer-checked:bg-sunken peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus">
                {m === "ranked" ? "Ranked" : "A–Z"}
              </span>
            </label>
          ))}
        </div>
        <label className="field flex h-11 min-w-[200px] flex-1 items-center gap-2.5 bg-raised px-3 sm:max-w-[300px]">
          <Search size={16} className="shrink-0 text-muted" /><span className="sr-only">Search countries</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries…" className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted outline-none" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="grid size-6 place-items-center text-muted hover:text-ink"><Close size={14} /></button>}
        </label>
        <Select label="Band" value={singleBand != null ? String(singleBand) : filterBand ? "multi" : "all"} active={!!filterBand} minMenuWidth={260}
          onChange={(v) => setBands(v === "all" ? null : new Set([Number(v)]))} className="w-full sm:w-auto [&>button]:sm:w-[200px]"
          options={[
            { value: "all", label: "All bands", meta: `${bandCounts.reduce((t, n) => t + n, 0)}` },
            ...bands.map((b, i) => ({ value: String(i), label: b.label, hint: `${b.min}–${b.max}`, swatch: b.fill, meta: `${bandCounts[i]}`, disabled: bandCounts[i] === 0 })),
            ...(filterBand && singleBand == null ? [{ value: "multi", label: "Several bands", disabled: true }] : []),
          ]} />
        <Select label="Rank by" value={measure} minMenuWidth={240} className="w-full sm:w-auto [&>button]:sm:w-[230px]"
          onChange={(v) => { setMeasure(v); setDir("desc"); setMode("ranked"); }}
          options={[...columns].reverse().map((c) => ({ value: c.key, label: c.label }))} />
        {narrowed && <button type="button" onClick={clearAll} className="h-10 px-1 text-[13px] font-semibold text-link underline decoration-1 underline-offset-4">Clear filters</button>}
        <p className="ml-auto text-[13px] text-muted num" aria-live="polite">
          {rows.length} of {countries.length} countries{filterBand && <> · {singleBand != null ? bands[singleBand].label : "several bands"} on {rankLabel.toLowerCase()}</>}
        </p>
      </div>

      {/* the one readiness key for every chip in the table */}
      <ul aria-label="Readiness bands" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
        <li className="text-muted">Readiness</li>
        {bands.map((b) => (
          <li key={b.label} className="flex items-center gap-1.5">
            <span aria-hidden className="legend-chip" style={{ "--chip": b.fill } as React.CSSProperties} />
            <span className="text-ink-2">{b.label}</span><span className="text-muted num">{b.min}–{b.max}</span>
          </li>
        ))}
      </ul>

      {/* A–Z: jump to a letter (hidden while searching, so the two don't fight) */}
      {mode === "az" && !n && (
        <nav aria-label="Jump to letter" className="az-nav mt-4 flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {LETTERS.map((L) => {
            const has = letters.has(L);
            return (
              <button key={L} type="button" disabled={!has} onClick={() => jumpTo(L)} aria-current={activeLetter === L ? "true" : undefined}
                aria-label={has ? `Jump to ${L}` : `${L}: no countries`}
                className={`grid h-9 min-w-9 shrink-0 place-items-center text-[13px] font-medium transition-colors ${activeLetter === L ? "bg-[var(--seg-on-bg)] text-[var(--seg-on-ink)]" : has ? "text-ink-2 hover:bg-sunken hover:text-ink" : "cursor-default text-line-strong"}`}>{L}</button>
            );
          })}
        </nav>
      )}

      {rows.length === 0 && (
        <div className="mt-8 border-y border-line py-10 text-center">
          <p className="text-[15px] text-ink">No countries match{n && <> “{q.trim()}”</>}{filterBand && <> in this band</>}.</p>
          <p className="mt-1 text-[13.5px] text-muted">Try another spelling or ISO code, or clear the filters.</p>
          <button type="button" onClick={clearAll} className="mt-4 text-[13.5px] font-semibold text-link underline decoration-1 underline-offset-4">Reset filters</button>
        </div>
      )}

      {/* desktop and tablet: one data table */}
      {rows.length > 0 && (
        <div className="rank-scroll mt-5 hidden overflow-x-auto md:block xl:overflow-visible">
          <table className="rank-table w-full border-collapse">
            <caption className="sr-only">
              {meta.index_name}: {mode === "az" ? "countries A to Z" : `ranked on ${rankLabel}, ${dir === "desc" ? "highest first" : "lowest first"}`}. Select a score for its rationale and sources.
            </caption>
            <thead className="z-10 xl:sticky xl:top-16">
              <tr className="border-b border-line-strong">
                {mode === "ranked" && <th scope="col" className="sticky-col left-0 w-12 pb-2 pr-2 text-right align-bottom text-[12px] font-medium text-muted">Rank<span className="sr-only"> on {rankLabel}</span></th>}
                <th scope="col" className={`sticky-col ${mode === "ranked" ? "left-12" : "left-0"} pb-2 pl-3 text-left align-bottom text-[12.5px] font-medium text-muted`}>Country</th>
                {columns.map((col) => (
                  <th key={col.key} scope="col" aria-sort={ariaSort(col.key)} className={`px-1 pb-2 text-left align-bottom ${col.key === COMPOSITE ? "composite-col" : ""}`}>
                    <button type="button" onClick={() => sortBy(col.key)} className={`sort-btn group/s inline-flex items-end gap-1 pl-1 text-left text-[12.5px] leading-tight ${sortedCol === col.key ? "is-sorted font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"}`}>
                      <span>{col.label}</span>
                      <ChevronDown size={13} className={`mb-px shrink-0 transition-transform ${sortedCol === col.key ? "text-ink" : "text-transparent group-hover/s:text-muted"} ${sortedCol === col.key && dir === "asc" ? "rotate-180" : ""}`} />
                      <span className="sr-only">{sortedCol === col.key ? `, sorted ${dir === "desc" ? "highest first" : "lowest first"}. Select to reverse` : ". Select to rank by this"}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((c, i) => {
                const L = letterOf(c.name);
                const newGroup = mode === "az" && (i === 0 || letterOf(shown[i - 1].name) !== L);
                return <Fragment key={c.country_id}>{newGroup && groupRow(L)}{renderRow(c)}</Fragment>;
              })}
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

      {/* phones: a country list on the same rows; expand for the pillar scores */}
      {rows.length > 0 && (
        <ol className="mt-5 grid border-t border-line md:hidden">
          {[...shown, ...(pinned ? [pinned] : [])].map((c, i, all) => {
            const open = expanded === c.country_id;
            const v = valueOf(c);
            const b = v != null ? bandFor(v, meta.score_bands) : null;
            const L = letterOf(c.name);
            const newGroup = mode === "az" && (i === 0 || letterOf(all[i - 1].name) !== L);
            return (
              <Fragment key={c.country_id}>
                {newGroup && <li data-letter={L} className="scroll-mt-28 border-b border-line pb-1 pt-4 text-[13px] font-semibold text-ink">{L}</li>}
                <li className={`border-b border-line ${c.country_id === selectedId ? "bg-sunken" : ""}`}>
                  <div className="flex items-center gap-2 py-2.5 pr-1">
                    {mode === "ranked" && <span className="w-8 shrink-0 text-right text-[13px] text-muted num">{ranks.get(c.country_id) ?? "–"}</span>}
                    <Link href={`/country/${c.slug}`} onClick={remember} className="min-w-0 flex-1 pl-1 text-[15px] font-medium leading-snug text-ink">{c.name}</Link>
                    <span className="shrink-0" title={b ? `${b.label} (${b.min}–${b.max})` : undefined}>
                      {v != null && b ? <><ScoreChipCell value={fmtScore(v)} fill={b.fill} composite={measure === COMPOSITE} /><span className="sr-only">, {b.label} band</span></> : <span className="text-[12px] text-muted">Not available</span>}
                    </span>
                    <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${c.name} pillar scores`} onClick={() => setExpanded(open ? null : c.country_id)} className="grid size-11 shrink-0 place-items-center text-muted">
                      <ChevronDown size={16} className={open ? "rotate-180" : ""} />
                    </button>
                  </div>
                  {open && (
                    <div className="pb-3 pl-10 pr-2">
                      <ul className="grid">
                        {columns.map((col) => (
                          <li key={col.key} className="flex items-center justify-between gap-3 border-t border-line py-1.5">
                            <span className="min-w-0 text-[13.5px] text-ink-2">{col.label}</span>
                            <span className="w-28 shrink-0">{scoreCell(c, col.key, col.label, col.key === COMPOSITE)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex gap-4 text-[13px] font-semibold">
                        <Link href={`/country/${c.slug}`} onClick={remember} className="text-link underline decoration-1 underline-offset-4">Country profile</Link>
                      </div>
                    </div>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}

      {/* footer: how much is showing, and more */}
      {rows.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <p className="text-muted num">Showing {shown.length} of {rows.length} {rows.length === 1 ? "country" : "countries"}</p>
          {rows.length > limit && <>
            <button type="button" onClick={() => setLimit(limit + PAGE)} className="font-semibold text-link underline decoration-1 underline-offset-4">Show {Math.min(PAGE, rows.length - limit)} more</button>
            <button type="button" onClick={() => setLimit(rows.length)} className="font-semibold text-link underline decoration-1 underline-offset-4">Show all</button>
          </>}
          {limit > PAGE && rows.length > PAGE && (
            <button type="button" onClick={() => { setLimit(PAGE); document.getElementById("rankings")?.scrollIntoView({ block: "start" }); }} className="font-semibold text-link underline decoration-1 underline-offset-4">Show fewer</button>
          )}
        </div>
      )}
    </section>
  );
}

/** A compact numeric chip tinted by its readiness band (theme-aware tint, readable ink). */
function ScoreChipCell({ value, fill, composite }: { value: string; fill: string; composite: boolean }) {
  // .rank-score: a soft band-tinted chip; the number is its most prominent element
  return (
    <span className={`rank-score num ${composite ? "is-composite" : ""}`} style={{ "--chip": fill } as React.CSSProperties}>{value}</span>
  );
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
