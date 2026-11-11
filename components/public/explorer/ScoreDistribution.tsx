"use client";
import { useMemo, useRef, useState } from "react";
import { distribution, type BandShare } from "@/lib/distribution";
import { ArrowRight } from "@/components/ui/icons";
import { COMPOSITE, useExplorer } from "./ExplorerContext";

const OVERVIEW = "__overview";
type Assessment = { id: string; name: string; dist: ReturnType<typeof distribution> };
type Pick = { aid: string; band: number } | null;
const plural = (n: number) => (n === 1 ? "country" : "countries");

/** Global performance: how countries spread across the workbook's readiness bands.
 *  Global overview (default) — one aligned 100% bar per assessment (composite when enabled,
 *    then every pillar), each counted on its own: one country, one score; missing scores
 *    are excluded from that row's denominator and reported beside it. A shared legend
 *    highlights a band across every row (hover/focus), or locks it (click). One sentence
 *    of insight is computed from the shares — never invented.
 *  An assessment tab — a large single bar with a breakdown per band.
 *  Selecting a segment (or a band in the breakdown) only highlights it; "View countries"
 *  hands the assessment and band to the shared explorer state (rank-by + band filter) and
 *  scrolls to the rankings. Bands, thresholds, labels and colours all come from the workbook. */
export function ScoreDistribution() {
  const { summary, setMeasure, setBands, bandFilter, clearBands, measure } = useExplorer();
  const { meta, pillars, countries } = summary;

  const assessments: Assessment[] = useMemo(() => [
    ...(meta.show_composite ? [{ id: COMPOSITE, name: "Composite score", values: countries.map((c) => c.composite_score) }] : []),
    ...pillars.map((p) => ({ id: p.pillar_id, name: p.name, values: countries.map((c) => c.scores[p.pillar_id] ?? null) })),
  ].map((a) => ({ id: a.id, name: a.name, dist: distribution(a.values, meta.score_bands) })), [meta, pillars, countries]);
  const bands = useMemo(() => assessments[0]?.dist.bands ?? [], [assessments]);

  const [tab, setTab] = useState<string>(OVERVIEW);
  const [pick, setPick] = useState<Pick>(null);
  const [hoverBand, setHoverBand] = useState<number | null>(null);
  const [lockBand, setLockBand] = useState<number | null>(null);
  const [tip, setTip] = useState<{ aid: string; band: number } | null>(null);
  const tabs = useRef<HTMLDivElement>(null);

  const focusBand = hoverBand ?? lockBand;
  const current = assessments.find((a) => a.id === tab);
  const picked = pick ? assessments.find((a) => a.id === pick.aid) : undefined;
  const pickedBand = picked && pick ? picked.dist.bands[pick.band] : undefined;

  const choose = (aid: string, band: number) => {
    const a = assessments.find((x) => x.id === aid);
    if (!a?.dist.bands[band].count) return;
    setPick((p) => (p && p.aid === aid && p.band === band ? null : { aid, band }));
  };
  const viewCountries = () => {
    if (!pick) return;
    setMeasure(pick.aid);
    setBands(new Set([pick.band]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("rankings")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    document.getElementById("rankings-h")?.focus({ preventScroll: true });
  };
  const clear = () => {
    if (pick && bandFilter?.size === 1 && bandFilter.has(pick.band) && measure === pick.aid) clearBands();
    setPick(null);
  };

  const tabList = [{ id: OVERVIEW, name: "Global overview" }, ...assessments.map((a) => ({ id: a.id, name: a.name }))];
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabList.length - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const n = (next + tabList.length) % tabList.length;
    setTab(tabList[n].id);
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
  };

  return (
    <section id="distribution" aria-labelledby="dist-h" className="wrap pb-[clamp(4rem,9vh,6.5rem)]">
      <p className="eyebrow">Global performance</p>
      <h2 id="dist-h" className="mt-3 text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em] text-ink">
        Where countries <span className="grad-text">stand</span>
      </h2>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-muted">
        Understand how countries are distributed across readiness levels and how performance varies between assessment pillars.
      </p>

      {/* assessment tabs: plain text, teal underline; only this strip scrolls on narrow screens */}
      <div ref={tabs} role="tablist" aria-label="Assessment" className="mt-7 flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabList.map((t, i) => {
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" role="tab" id={`dist-tab-${i}`} aria-selected={on} aria-controls="dist-panel" tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}
              className={`relative -mb-px shrink-0 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[14px] font-medium transition-colors focus-visible:-outline-offset-2 ${on ? "border-[var(--teal)] text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t.name}
            </button>
          );
        })}
      </div>

      <div id="dist-panel" role="tabpanel" aria-labelledby={`dist-tab-${tabList.findIndex((t) => t.id === tab)}`} className="mt-6">
        {tab === OVERVIEW ? (
          <>
            <div className="grid gap-y-3.5" onMouseLeave={() => setTip(null)}>
              {assessments.map((a) => (
                <div key={a.id} className="grid grid-cols-1 items-center gap-x-5 gap-y-1.5 sm:grid-cols-[minmax(150px,210px)_minmax(0,1fr)]">
                  <button type="button" onClick={() => setTab(a.id)} className="justify-self-start text-left text-[13.5px] font-medium text-ink hover:text-link hover:underline hover:underline-offset-4">{a.name}</button>
                  <DistBar a={a} height={26} focusBand={focusBand} pick={pick} tip={tip} setTip={setTip} onPick={choose} />
                  {/* only the exception is spelled out: a row with countries missing a score */}
                  {a.dist.missing > 0 && <p className="text-[11.5px] text-muted num sm:col-start-2">{a.dist.missing} {plural(a.dist.missing)} without a score</p>}
                </div>
              ))}
            </div>

            {/* one shared legend: hover/focus highlights a band in every row; click locks it */}
            <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-line pt-4">
              <span id="legend-l" className="sr-only">Highlight a readiness band across assessments</span>
              <div role="group" aria-labelledby="legend-l" className="flex flex-wrap gap-x-1 gap-y-1">
                {bands.map((b) => {
                  const locked = lockBand === b.index;
                  return (
                    <button key={b.label} type="button" aria-pressed={locked}
                      onMouseEnter={() => setHoverBand(b.index)} onMouseLeave={() => setHoverBand(null)}
                      onFocus={() => setHoverBand(b.index)} onBlur={() => setHoverBand(null)}
                      onClick={() => setLockBand(locked ? null : b.index)}
                      className={`flex h-9 items-center gap-2 px-2.5 text-[13px] transition-colors ${locked ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-sunken/60"}`}>
                      <span aria-hidden className="size-2.5 ring-1 ring-black/10" style={{ background: b.fill }} />
                      {b.label}<span className="text-muted num">{b.min}–{b.max}</span>
                    </button>
                  );
                })}
              </div>
              {lockBand != null && <button type="button" onClick={() => setLockBand(null)} className="ml-2 text-[13px] font-semibold text-link underline decoration-1 underline-offset-4">Show all bands</button>}
            </div>
          </>
        ) : current && (
          <>
            {current.dist.missing > 0 && <p className="mb-3 text-[12.5px] text-muted num">{current.dist.missing} {plural(current.dist.missing)} without a score on this assessment</p>}
            {current.dist.total === 0 ? (
              <p className="mt-4 border-y border-line py-6 text-[14px] text-muted">No country has a score on this assessment yet.</p>
            ) : (
              <>
                <div><DistBar a={current} height={48} labels focusBand={null} pick={pick} tip={tip} setTip={setTip} onPick={choose} /></div>
                <div aria-hidden className="mt-2 flex justify-between text-[11.5px] text-muted"><span>← Lower readiness</span><span>Higher readiness →</span></div>
              </>
            )}
            {/* the breakdown: count first; these are the keyboard route to selecting a band */}
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ "--n": bands.length } as React.CSSProperties}>
              {current.dist.bands.map((b) => {
                const on = pick?.aid === current.id && pick.band === b.index;
                return (
                  <li key={b.label}>
                    <button type="button" disabled={b.count === 0} aria-pressed={on} onClick={() => choose(current.id, b.index)}
                      aria-label={`${b.label}, ${b.min}–${b.max}: ${b.count} ${plural(b.count)}, ${b.pct}% of ${current.dist.total}`}
                      className={`dist-band flex w-full flex-col items-start gap-1 border-t-2 px-1 pb-3 pt-3 text-left transition-colors disabled:cursor-default ${on ? "bg-sunken" : "hover:bg-sunken/60 disabled:hover:bg-transparent"}`}
                      style={{ borderTopColor: b.fill }}>
                      <span className="text-[24px] font-semibold leading-none tracking-tight text-ink num">{b.count}</span>
                      <span className="text-[13px] font-medium text-ink">{b.label} <span className="font-normal text-muted num">{b.min}–{b.max}</span></span>
                      <span className="text-[12px] text-muted num">{b.count ? `${b.pct}% of countries` : "No countries"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* the selection: summary and the way to the countries (never navigates on its own) */}
        <div className={`mt-5 flex min-h-11 flex-wrap items-center gap-x-5 gap-y-2 ${picked && pickedBand ? "" : "invisible"}`} aria-live="polite">
          {picked && pickedBand && <>
            <p className="text-[14px] text-ink-2"><span className="font-semibold text-ink">{picked.name}</span> · {pickedBand.label} · {pickedBand.count} {plural(pickedBand.count)} ({pickedBand.pct}%)</p>
            <button type="button" onClick={viewCountries} className="btn">View countries<span className="box"><ArrowRight size={16} /></span></button>
            <button type="button" onClick={clear} className="text-[13px] font-semibold text-link underline decoration-1 underline-offset-4">Clear selection</button>
          </>}
        </div>

        {/* text alternative for the whole comparison (wrapped: a table ignores sr-only sizing) */}
        <div className="sr-only"><table>
          <caption>Countries per readiness band, by assessment (share of countries with a score)</caption>
          <thead><tr><th scope="col">Assessment</th>{bands.map((b) => <th key={b.label} scope="col">{b.label} ({b.min}–{b.max})</th>)}<th scope="col">With a score</th><th scope="col">Without a score</th></tr></thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id}><th scope="row">{a.name}</th>{a.dist.bands.map((b) => <td key={b.label}>{b.count} ({b.pct}%)</td>)}<td>{a.dist.total}</td><td>{a.dist.missing}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/** One 100% bar: segments are buttons (hover/focus shows a tooltip; click selects). */
function DistBar({ a, height, labels = false, focusBand, pick, tip, setTip, onPick }: {
  a: Assessment; height: number; labels?: boolean; focusBand: number | null; pick: Pick;
  tip: { aid: string; band: number } | null; setTip: (t: { aid: string; band: number } | null) => void;
  onPick: (aid: string, band: number) => void;
}) {
  const segs = a.dist.bands.filter((b) => b.count > 0);
  const shown = tip?.aid === a.id ? a.dist.bands[tip.band] : null;
  const mid = (b: BandShare) => a.dist.bands.slice(0, b.index).reduce((t, x) => t + x.share, 0) + b.share / 2;
  if (!a.dist.total) return <div className="flex items-center text-[12.5px] text-muted" style={{ height }}>No scores</div>;
  return (
    <div className="relative min-w-0">
      <div className="flex w-full gap-px" style={{ height }}>
        {segs.map((b) => {
          const on = pick?.aid === a.id && pick.band === b.index;
          const dim = (focusBand != null && focusBand !== b.index) || (pick != null && pick.aid === a.id && !on);
          return (
            <button key={b.label} type="button" onClick={() => onPick(a.id, b.index)}
              onMouseEnter={() => setTip({ aid: a.id, band: b.index })} onFocus={() => setTip({ aid: a.id, band: b.index })} onBlur={() => setTip(null)}
              aria-pressed={on} aria-label={`${a.name}, ${b.label} ${b.min}–${b.max}: ${b.count} ${plural(b.count)}, ${b.pct}%`}
              className="dist-seg relative flex min-w-[4px] items-center justify-center overflow-hidden text-[13px] font-semibold num focus-visible:z-10 focus-visible:-outline-offset-2"
              data-dim={dim ? "" : undefined} data-on={on ? "" : undefined}
              style={{ flexGrow: b.share, flexBasis: 0, background: b.fill, color: b.ink }}>
              {labels && b.share >= 0.07 && <span aria-hidden>{b.pct}%</span>}
            </button>
          );
        })}
      </div>
      {shown && (
        <div aria-hidden className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 whitespace-nowrap border border-line bg-raised px-3 py-2 shadow-soft"
          style={{ left: `clamp(70px, ${mid(shown) * 100}%, calc(100% - 70px))` }}>
          <p className="text-[12px] text-muted">{a.name}</p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink">{shown.label} <span className="font-normal text-muted num">· {shown.min}–{shown.max}</span></p>
          <p className="mt-0.5 text-[12.5px] text-ink-2 num">{shown.count} {plural(shown.count)} · {shown.pct}%</p>
        </div>
      )}
    </div>
  );
}
