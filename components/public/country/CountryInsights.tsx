"use client";
import { useEffect, useRef, useState } from "react";
import { fmtScore } from "@/lib/bands";
import { ArrowUpRight } from "@/components/ui/icons";

export type PillarRow = {
  id: string; name: string; description: string;
  score: number | null; median: number | null;
  band: { label: string; min: number; max: number; fill: string } | null;
  rationale: string;
  references: { title: string; publisher: string; date: string | null; url: string | null }[];
};

/** Pillar performance and the evidence behind it, sharing one active pillar.
 *  The chart: one bar per pillar on the workbook scale with a marker at that pillar's index
 *  median; hover / focus shows score, median, difference and band. Choosing a bar makes
 *  that pillar active in the explorer below and brings it into view.
 *  The explorer: pillars as tabs on the left, the published rationale and sources on the
 *  right (stacked on phones). Nothing is rewritten: rationale text is shown as published. */
export function CountryInsights({ rows, min, max }: { rows: PillarRow[]; min: number; max: number }) {
  const scored = rows.filter((r) => r.score != null);
  const [active, setActive] = useState(scored[0]?.id ?? rows[0]?.id);
  const [tip, setTip] = useState<string | null>(null);
  const explorer = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  // a #pillar-id in the address opens that pillar
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    // one-off sync from the URL after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (h && rows.some((r) => r.id === h)) setActive(h);
  }, [rows]);

  const openPillar = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    explorer.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus({ preventScroll: true }));
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : null;
    if (n == null) return;
    e.preventDefault();
    const r = rows[(n + rows.length) % rows.length];
    setActive(r.id);
    document.getElementById(`tab-${r.id}`)?.focus();
  };
  const cur = rows.find((r) => r.id === active);

  return (
    <>
      {/* ── performance ── */}
      <section id="performance" aria-labelledby="perf-h" className="scroll-mt-32 py-12">
        <h2 id="perf-h" className="text-[24px] font-bold tracking-[-0.02em] text-ink">Pillar performance</h2>
        <p className="mt-1.5 text-[14px] text-muted">Each pillar against its index median. Select one for the evidence.</p>
        <ul className="mt-6 grid" onMouseLeave={() => setTip(null)}>
          {rows.map((r) => {
            if (r.score == null || !r.band) return (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line py-3.5 md:grid-cols-[220px_minmax(0,1fr)_64px]">
                <span className="text-[14.5px] text-ink-2">{r.name}</span>
                <span aria-hidden className="col-span-2 row-start-2 h-2 border border-dashed border-line-strong md:col-span-1 md:col-start-2 md:row-start-1" />
                <span className="text-right text-[12.5px] text-muted">Not scored</span>
              </li>
            );
            const diff = r.median != null ? Math.round((r.score - r.median) * 10) / 10 : null;
            const on = active === r.id, showTip = tip === r.id;
            return (
              <li key={r.id} className="relative border-b border-line">
                <button type="button" onClick={() => openPillar(r.id)} onMouseEnter={() => setTip(r.id)} onFocus={() => setTip(r.id)} onBlur={() => setTip(null)}
                  aria-label={`${r.name}: ${fmtScore(r.score)}, ${r.band.label}${r.median != null ? `; index median ${fmtScore(r.median)}, ${diff! >= 0 ? "+" : ""}${fmtScore(diff!)}` : ""}. Show the evidence`}
                  className={`perf-row group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 text-left md:grid-cols-[220px_minmax(0,1fr)_64px] ${on ? "is-on" : ""}`}>
                  <span className={`text-[14.5px] ${on ? "font-semibold text-ink" : "text-ink-2 group-hover:text-ink"}`}>{r.name}</span>
                  <span aria-hidden className="relative col-span-2 row-start-2 block h-2 bg-[var(--line)] md:col-span-1 md:col-start-2 md:row-start-1">
                    <span className="absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct(r.score)}%`, background: r.band.fill }} />
                    {r.median != null && <span className="absolute -inset-y-1.5 w-[2px] bg-ink" style={{ left: `calc(${pct(r.median)}% - 1px)` }} />}
                  </span>
                  <span className="text-right text-[17px] font-semibold text-ink num">{fmtScore(r.score)}</span>
                </button>
                {showTip && (
                  <div aria-hidden className="pointer-events-none absolute right-0 top-full z-10 -mt-1 whitespace-nowrap border border-line bg-raised px-3 py-2 text-[12.5px] shadow-soft md:right-auto md:left-[calc(220px+1rem)]">
                    <span className="font-semibold text-ink num">{fmtScore(r.score)}</span> <span className="text-muted">· {r.band.label} ({r.band.min}–{r.band.max})</span>
                    {r.median != null && <span className="ml-2 text-ink-2 num">median {fmtScore(r.median)} · <span className={diff! >= 0 ? "text-[var(--link)]" : ""}>{diff! >= 0 ? "+" : "−"}{fmtScore(Math.abs(diff!))}</span></span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted"><span aria-hidden className="inline-block h-3 w-[2px] bg-ink" />Index median for each pillar · scale {min}–{max}</p>
      </section>

      {/* ── evidence ── */}
      <section id="assessments" ref={explorer} aria-labelledby="assess-h" className="scroll-mt-32 border-t border-line py-12">
        <h2 id="assess-h" className="text-[24px] font-bold tracking-[-0.02em] text-ink">Assessment details</h2>
        <p className="mt-1.5 text-[14px] text-muted">The published rationale for each pillar score, with its sources.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
          <div role="tablist" aria-label="Pillars" aria-orientation="vertical" className="grid content-start gap-px">
            {rows.map((r, i) => {
              const on = r.id === active;
              return (
                <button key={r.id} id={`tab-${r.id}`} type="button" role="tab" aria-selected={on} aria-controls="assess-panel" tabIndex={on ? 0 : -1}
                  onClick={() => { setActive(r.id); window.history.replaceState(null, "", `#${r.id}`); }} onKeyDown={(e) => onTabKey(e, i)}
                  className={`assess-tab flex items-center justify-between gap-3 border-l-2 px-3.5 py-3 text-left transition-colors ${on ? "border-[var(--teal)] bg-raised" : "border-transparent hover:bg-sunken/70"}`}>
                  <span className={`text-[14.5px] ${on ? "font-semibold text-ink" : "text-ink-2"}`}>{r.name}</span>
                  {r.score != null && r.band
                    ? <span className="score-chip inline-flex h-6 min-w-[40px] items-center justify-end px-1.5 text-[13px] font-medium num" style={{ "--chip": r.band.fill } as React.CSSProperties}>{fmtScore(r.score)}</span>
                    : <span className="text-[12px] text-muted">—</span>}
                </button>
              );
            })}
          </div>
          {cur && (
            <div id="assess-panel" role="tabpanel" aria-labelledby={`tab-${cur.id}`} tabIndex={0} className="min-w-0 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1">
              <h3 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{cur.name}</h3>
              {cur.description && <p className="mt-1 text-[14px] text-muted">{cur.description}</p>}
              {cur.score != null && cur.band ? (
                <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                  <p className="flex items-end gap-3">
                    <span className="text-[44px] font-semibold leading-[.9] tracking-[-0.03em] text-ink num">{fmtScore(cur.score)}</span>
                    <span className="pb-0.5 leading-tight">
                      <span className="block text-[15px] font-semibold text-ink">{cur.band.label}</span>
                      <span className="block text-[12.5px] text-muted num">{cur.band.min}–{cur.band.max} band</span>
                    </span>
                  </p>
                  {cur.median != null && <p className="pb-0.5 text-[13px] text-muted num">Index median {fmtScore(cur.median)} · {cur.score - cur.median >= 0 ? "+" : "−"}{fmtScore(Math.abs(Math.round((cur.score - cur.median) * 10) / 10))}</p>}
                </div>
              ) : <p className="mt-4 text-[15px] text-muted">No score is published for this pillar.</p>}

              <h4 className="label mt-7 text-muted">Why this score</h4>
              {cur.rationale
                ? <p className="mt-2 max-w-[72ch] whitespace-pre-line text-[16px] leading-[1.75] text-ink-2">{cur.rationale}</p>
                : <p className="mt-2 text-[15px] text-muted">No rationale has been published for this score.</p>}

              <h4 className="label mt-7 text-muted">Sources{cur.references.length > 0 && <span className="num"> · {cur.references.length}</span>}</h4>
              {cur.references.length === 0 ? <p className="mt-2 text-[14px] text-muted">No sources are listed for this score.</p> : (
                <ul className="mt-2 max-w-[72ch] border-t border-line">
                  {cur.references.map((ref, i) => (
                    <li key={i} className="border-b border-line">
                      {ref.url ? (
                        <a href={ref.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 py-3 hover:bg-sunken/50">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-medium text-ink group-hover:text-link group-hover:underline group-hover:underline-offset-4">{ref.title || ref.url}</span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">{[ref.publisher, ref.date].filter(Boolean).join(" · ") || "Publisher not stated"}</span>
                          </span>
                          <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-muted group-hover:text-link" /><span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        <p className="py-3">
                          <span className="block text-[14.5px] font-medium text-ink">{ref.title || "Untitled source"}</span>
                          <span className="mt-0.5 block text-[12.5px] text-muted">{[ref.publisher, ref.date].filter(Boolean).join(" · ") || "Publisher not stated"}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
