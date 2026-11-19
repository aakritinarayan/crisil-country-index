"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { allBands, bandFor, fmtScore, formatAsOfShort } from "@/lib/bands";
import { compareRanks, ranksOn, type RankChange } from "@/lib/ranking";
import { ChevronDown, Close, Search, SortArrows } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { COMPOSITE, useExplorer, type SummaryCountry } from "./ExplorerContext";
import { nCountries } from "@/lib/plural";

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
 *  Ranked lists only the countries with a score on the active measure; the rest are counted
 *  in a note under the table, as are countries in scope but not yet assessed.
 *  Previous ranking / Movement vs. previous (ranked only) follow the active measure too, and
 *  come from the previous assessment period's stored scores (lib/ranking.ts compareRanks):
 *  "—" with the reason whenever there is no valid comparison — never an inferred rank.
 *  Search (name or ISO code) and the band filter (on the active measure; shared with the
 *  map legend) work in both modes. Rows appear 25 at a time. Every score opens the
 *  rationale drawer; a country name opens its profile directly. Columns, bands and labels all come from the workbook. */
export function Rankings() {
  const { summary, selectedId, measure, setMeasure, measureLabel, valueOf, overview, bandFilter, setBands, openScore, activeScore } = useExplorer();
  const { meta, pillars, countries, notAssessed, previous } = summary;
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

  // ranks on the active measure, over every country (never just the rows on screen), and the
  // same measure's ranks in the previous period
  const ranks = useMemo(() => ranksOn(countries, measure), [countries, measure]);
  const changes = useMemo(() => compareRanks(countries, previous, measure), [countries, previous, measure]);
  const unranked = countries.filter((c) => valueOf(c) == null).length;

  const filterBand = bandFilter;
  const rows = useMemo(() => {
    const list = searched.filter((c) => {
      if (mode === "ranked" && valueOf(c) == null) return false; // only what is ranked on this measure
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
  // in running text: "composite", but a pillar keeps its own casing ("Corporate RE market")
  const rankLabelInText = measure === COMPOSITE ? "composite" : measureLabel;
  const sortedCol = mode === "ranked" ? measure : null;

  const scoreCell = (c: SummaryCountry, key: string, label: string, composite = false) => {
    const v = scoreOf(c, key);
    if (v == null) return <span className="text-[12.5px] text-muted">Not available</span>;
    const b = bandFor(v, meta.score_bands);
    // a softly tinted chip: the number is the content, the band only tints it (named in
    // the shared legend above, in the hover title and in the accessible name)
    const chip = <ScoreChipCell value={fmtScore(v)} fill={b.fill} ink={b.ink} composite={composite} />;
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
      <Link href={`/country/${c.slug}`} onClick={remember} className="country-link tap text-[14.5px] font-medium leading-snug text-ink hover:text-link hover:underline hover:underline-offset-4">
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
        <th scope="row" className={`sticky-col ${mode === "ranked" ? "left-12" : "left-0"} min-w-[124px] max-w-[240px] py-1.5 pl-3 pr-3 text-left font-normal lg:min-w-[180px]`}>{countryCell(c)}</th>
        {mode === "ranked" && <>
          <td className="hist-col px-2 py-1.5"><PreviousRank change={changes.get(c.country_id)} /></td>
          <td className="hist-col px-2 py-1.5"><Movement change={changes.get(c.country_id)} /></td>
        </>}
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
      <th colSpan={columns.length + (mode === "ranked" ? 4 : 1)} scope="rowgroup" data-letter={L} className="az-head scroll-mt-32 border-b border-line pb-1.5 pt-5 pl-3 text-left text-[13px] font-semibold text-ink">{L}</th>
    </tr>
  );

  const ariaSort = (key: string): "ascending" | "descending" | undefined =>
    sortedCol !== key ? undefined : dir === "desc" ? "descending" : "ascending";

  return (
    <section id="rankings" aria-labelledby="rankings-h" className="wrap scroll-mt-4">
      <p className="eyebrow">Country rankings</p>
      <h2 id="rankings-h" tabIndex={-1} className="t-h2 mt-3 outline-none">Every country, <span className="grad-text">every pillar</span></h2>
      <p className="mt-4 max-w-[64ch] text-muted">
        Explore how countries perform across key assessment pillars. Sort rankings, find countries, or select a score to understand the evidence behind it.
      </p>
      <p className="mt-2 text-[13.5px] text-muted num">Scores range from {meta.score_min} to {meta.score_max} and are grouped into {WORDS[bands.length] ?? bands.length} readiness bands. Select a score to explore its rationale and sources.</p>

      {/* toolbar: browse mode · search · band · rank by · clear. Below lg a 20-column grid —
          toggle 40% + search 60%, then the two selects at 50% (their labels kept for screen
          readers only), then the count; under 360px search takes its own row. From lg the
          one-row desktop arrangement. */}
      <div className="rank-toolbar mt-7 grid grid-cols-[repeat(20,minmax(0,1fr))] items-center gap-2.5 lg:flex lg:flex-wrap lg:gap-x-3">
        <div role="radiogroup" aria-label="Browse" className="col-span-8 flex h-11 border border-line bg-raised p-[3px] max-[359px]:col-span-20 lg:shrink-0">
          {(["ranked", "az"] as const).map((m) => (
            <label key={m} className="relative flex flex-1 cursor-pointer lg:flex-none">
              <input type="radio" name="rank-mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="peer sr-only" />
              <span className="flex w-full items-center justify-center whitespace-nowrap px-2.5 lg:px-3.5 text-[13px] font-medium text-muted transition-colors hover:text-ink peer-checked:bg-sunken peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus">
                {m === "ranked" ? "Ranked" : "A–Z"}
              </span>
            </label>
          ))}
        </div>
        <label className="field col-span-12 flex h-11 min-w-0 items-center gap-2.5 bg-raised px-3 max-[359px]:col-span-20 lg:min-w-[200px] lg:max-w-[300px] lg:flex-1">
          <Search size={16} className="shrink-0 text-muted" /><span className="sr-only">Search countries</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries…" className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted outline-none" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="grid size-6 place-items-center text-muted hover:text-ink"><Close size={14} /></button>}
        </label>
        <Select label="Band" value={singleBand != null ? String(singleBand) : filterBand ? "multi" : "all"} active={!!filterBand} minMenuWidth={260}
          onChange={(v) => setBands(v === "all" ? null : new Set([Number(v)]))} className="col-span-10 min-w-0 [&>span]:sr-only lg:w-auto lg:[&>span]:not-sr-only [&>button]:lg:w-[200px]"
          options={[
            { value: "all", label: "All bands", meta: `${bandCounts.reduce((t, n) => t + n, 0)}` },
            ...bands.map((b, i) => ({ value: String(i), label: b.label, hint: `${b.min}–${b.max}`, swatch: b.fill, meta: `${bandCounts[i]}`, disabled: bandCounts[i] === 0 })),
            ...(filterBand && singleBand == null ? [{ value: "multi", label: "Several bands", disabled: true }] : []),
          ]} />
        <Select label="Rank by" value={measure} minMenuWidth={240} className="col-span-10 min-w-0 [&>span]:sr-only lg:w-auto lg:[&>span]:not-sr-only [&>button]:lg:w-[230px]"
          onChange={(v) => { setMeasure(v); setDir("desc"); setMode("ranked"); }}
          options={[...columns].reverse().map((c) => ({ value: c.key, label: c.label }))} />
        <div className="col-span-20 flex flex-wrap items-center gap-x-3 lg:contents">
        {narrowed && <button type="button" onClick={clearAll} className="h-10 px-1 text-[13px] font-semibold text-link underline decoration-1 underline-offset-4">Clear filters</button>}
        <p className="ml-auto text-[12.5px] text-muted num lg:text-[13px]" aria-live="polite">
          {rows.length} of {nCountries(countries.length)}{filterBand && <> · {singleBand != null ? bands[singleBand].label : "several bands"} on {rankLabelInText}</>}
        </p>
        </div>
      </div>

      {/* the one readiness key for every chip in the table */}
      {/* one line on phones (label for screen readers only, a touch smaller; scrolls rather
          than wraps if a dataset ever has more bands than fit); wraps freely from sm */}
      <ul aria-label="Readiness bands" className="rank-legend mt-4 flex items-center gap-x-3 overflow-x-auto whitespace-nowrap text-[12px] max-[359px]:gap-x-2 max-[359px]:text-[11.5px] [scrollbar-width:none] sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:overflow-visible sm:text-[12.5px]">
        <li className="text-muted max-sm:sr-only">Readiness</li>
        {bands.map((b) => (
          <li key={b.label} className="flex shrink-0 items-center gap-1.5 max-[359px]:gap-1">
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
            <thead className="z-10 xl:sticky xl:top-0">
              <tr className="border-b border-line-strong">
                {mode === "ranked" && (
                  <th scope="col" className="sticky-col left-0 w-12 pb-2 pr-1 text-right align-bottom text-[12.5px] font-medium leading-tight text-ink-2">
                    {/* rank order is the measure's order: rank 1 first = highest score first */}
                    <button type="button" onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))} title="Sort by rank"
                      className="rank-sort" aria-label={`Rank on ${rankLabel}, ${dir === "desc" ? "1 first" : "last first"}. Select to show ${dir === "desc" ? "the last rank" : "rank 1"} first`}>
                      Rank<SortArrows size={14} active={dir === "desc" ? "up" : "down"} />
                    </button>
                  </th>
                )}
                <th scope="col" className={`sticky-col ${mode === "ranked" ? "left-12" : "left-0"} pb-2 pl-3 text-left align-bottom text-[12.5px] font-medium leading-tight text-ink-2`}>Country</th>
                {mode === "ranked" && <>
                  <th scope="col" className="hist-col px-2 pb-2 text-left align-bottom text-[12.5px] font-medium leading-tight text-ink-2"><span className="th-label">Previous ranking</span></th>
                  <th scope="col" className="hist-col px-2 pb-2 text-left align-bottom text-[12.5px] font-medium leading-tight text-ink-2"><span className="th-label">Movement vs. previous</span></th>
                </>}
                {columns.map((col) => (
                  <th key={col.key} scope="col" aria-sort={ariaSort(col.key)} className={`px-1 pb-2 text-left align-bottom ${col.key === COMPOSITE ? "composite-col" : ""}`}>
                    <button type="button" onClick={() => sortBy(col.key)} className={`sort-btn group/s inline-flex items-end gap-1 pl-1 text-left text-[12.5px] leading-tight ${sortedCol === col.key ? "is-sorted font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"}`}>
                      <span className="th-label">{col.label}</span>
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
                  <tr aria-hidden><td colSpan={columns.length + (mode === "ranked" ? 4 : 1)} className="py-1 text-center text-xs text-muted">· · ·</td></tr>
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
                    <Link href={`/country/${c.slug}`} onClick={remember} className="tap min-w-0 flex-1 pl-1 text-[15px] font-medium leading-snug text-ink">{c.name}</Link>
                    <span className="shrink-0" title={b ? `${b.label} (${b.min}–${b.max})` : undefined}>
                      {v != null && b ? <><ScoreChipCell value={fmtScore(v)} fill={b.fill} ink={b.ink} composite={measure === COMPOSITE} /><span className="sr-only">, {b.label} band</span></> : <span className="text-[12px] text-muted">Not available</span>}
                    </span>
                    <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${c.name} pillar scores`} onClick={() => setExpanded(open ? null : c.country_id)} className="grid size-11 shrink-0 place-items-center text-muted">
                      <ChevronDown size={16} className={open ? "rotate-180" : ""} />
                    </button>
                  </div>
                  {open && (
                    <div className="pb-3 pl-10 pr-2">
                      {mode === "ranked" && (
                        <dl className="grid">
                          <div className="flex items-center justify-between gap-3 border-t border-line py-1.5">
                            <dt className="text-[13.5px] text-ink-2">Previous ranking</dt>
                            <dd className="w-28 shrink-0 text-[13.5px]"><PreviousRank change={changes.get(c.country_id)} /></dd>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-line py-1.5">
                            <dt className="text-[13.5px] text-ink-2">Movement vs. previous</dt>
                            <dd className="w-28 shrink-0"><Movement change={changes.get(c.country_id)} /></dd>
                          </div>
                        </dl>
                      )}
                      <ul className="grid">
                        {columns.map((col) => (
                          <li key={col.key} className="flex items-center justify-between gap-3 border-t border-line py-1.5">
                            <span className="min-w-0 text-[13.5px] text-ink-2">{col.label}</span>
                            <span className="w-28 shrink-0">{scoreCell(c, col.key, col.label, col.key === COMPOSITE)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex gap-4 text-[13px] font-semibold">
                        <Link href={`/country/${c.slug}`} onClick={remember} className="tap text-link underline decoration-1 underline-offset-4">Country profile</Link>
                      </div>
                    </div>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}

      {/* what the previous-period columns compare with, and who isn't in the table */}
      <div className="mt-4 grid gap-1 text-[12.5px] leading-relaxed text-muted">
        {mode === "ranked" && (
          <p>{previous
            ? <>Previous ranking and movement compare {rankLabelInText} ranks with the {formatAsOfShort(previous.as_of)} assessment. Movement is shown only when the same countries were ranked in both.</>
            : <>Previous ranking and movement will appear once an earlier assessment period has been published.</>}</p>
        )}
        {mode === "ranked" && unranked > 0 && <p>{nCountries(unranked)} without a {rankLabelInText} score {unranked === 1 ? "is" : "are"} not ranked.</p>}
        {notAssessed.length > 0 && <p>In the assessment scope, not yet assessed: {notAssessed.map((x) => x.name).join(", ")}. {notAssessed.length === 1 ? "It has" : "They have"} no scores or rankings yet.</p>}
      </div>

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

/** A compact numeric chip tinted by its readiness band (theme-aware tint, readable ink).
 *  Composite chips take the band's full colour and its own light/dark ink. */
function ScoreChipCell({ value, fill, ink, composite }: { value: string; fill: string; ink: string; composite: boolean }) {
  // .rank-score: a soft band-tinted chip; the number is its most prominent element
  return (
    <span className={`rank-score num ${composite ? "is-composite" : ""}`} style={{ "--chip": fill, "--chip-ink": ink } as React.CSSProperties}>{value}</span>
  );
}

/** The country's rank on the active measure in the previous period, or "—" with the reason. */
function PreviousRank({ change }: { change?: RankChange }) {
  if (!change || change.previous == null) return <span className="text-[13px] text-muted" title={change?.reason ?? "Previous ranking unavailable."}>—<span className="sr-only">{change?.reason ?? "Previous ranking unavailable."}</span></span>;
  return <span className="text-[13px] text-ink-2 num" title={change.reason ?? undefined}>{change.previous}<span className="sr-only"> of {change.previousOf}</span></span>;
}

/** Rank movement: previous − current. A tinted chip with a triangle and the number of places, with the direction in
 *  words for screen readers (never colour alone); "—" when there is no valid comparison. */
function Movement({ change }: { change?: RankChange }) {
  const m = change?.movement;
  if (m == null) return <span className="text-[13px] text-muted" title={change?.reason ?? "Previous ranking unavailable."}>—<span className="sr-only">{change?.reason ?? "Movement unavailable."}</span></span>;
  if (m === 0) return <span className="rank-move is-same num" title="Unchanged since the previous assessment"><span aria-hidden>–</span>0<span className="sr-only"> places, unchanged</span></span>;
  const up = m > 0;
  return (
    <span className={`rank-move num ${up ? "is-up" : "is-down"}`} title={`${Math.abs(m)} ${Math.abs(m) === 1 ? "place" : "places"} ${up ? "up" : "down"} since the previous assessment`}>
      <svg aria-hidden width="9" height="8" viewBox="0 0 9 8" fill="currentColor">{up ? <path d="M4.5 0 9 8H0z" /> : <path d="M4.5 8 0 0h9z" />}</svg>{Math.abs(m)}<span className="sr-only"> {Math.abs(m) === 1 ? "place" : "places"} {up ? "up" : "down"}</span>
    </span>
  );
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
