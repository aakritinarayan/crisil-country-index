"use client";
import { useEffect, useState } from "react";
import { fmtScore } from "@/lib/bands";
import { ArrowUpRight, ChevronDown } from "@/components/ui/icons";

export type PillarRow = {
  id: string; name: string; description: string;
  score: number | null; median: number | null;
  band: { label: string; min: number; max: number; fill: string } | null;
  rationale: string;
  references: { title: string; publisher: string; date: string | null; url: string | null }[];
};

/** Pillar performance and the detailed assessments.
 *  Performance: one row per pillar — name, band chip, bar on the workbook scale with a
 *  marker at that pillar's index median, score; hover / focus adds median and difference.
 *  Choosing a row opens that pillar's assessment card below and brings it into view.
 *  Assessments: one card per pillar with the first sentence of the published rationale;
 *  expanding shows the full text and sources, exactly as published. */
export function CountryInsights({ rows, min, max, legend }: {
  rows: PillarRow[]; min: number; max: number; legend: { label: string; min: number; max: number; fill: string }[];
}) {
  const [tip, setTip] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const toggle = (id: string, force?: boolean) => setOpen((o) => { const n = new Set(o); if (force ?? !n.has(id)) n.add(id); else n.delete(id); return n; });
  const firstSentence = (t: string) => { const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); };

  // a #pillar-id in the address opens that pillar's card
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    // one-off sync from the URL after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (h && rows.some((r) => r.id === h)) setOpen(new Set([h]));
  }, [rows]);

  const openPillar = (id: string) => {
    toggle(id, true);
    window.history.replaceState(null, "", `#${id}`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      const card = document.getElementById(`a-${id}`);
      card?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      card?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      {/* ── pillar performance: the main comparison ── */}
      <section id="performance" aria-labelledby="perf-h" className="scroll-mt-24 py-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 id="perf-h" className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Pillar performance</h2>
            <p className="mt-1 text-[14px] text-muted">Each pillar against its index median. Select a pillar for the evidence.</p>
          </div>
          <BandLegend bands={legend} />
        </div>
        <ul className="mt-5 grid gap-1.5" onMouseLeave={() => setTip(null)}>
          {rows.map((r) => {
            if (r.score == null || !r.band) return (
              <li key={r.id} className="perf-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 md:grid-cols-[200px_96px_minmax(0,1fr)_48px]">
                <span className="text-[14.5px] text-ink-2">{r.name}</span>
                <span className="text-right text-[12.5px] text-muted md:col-start-4">Not scored</span>
              </li>
            );
            const diff = r.median != null ? Math.round((r.score - r.median) * 10) / 10 : null;
            const showTip = tip === r.id;
            return (
              <li key={r.id} className="relative">
                <button type="button" onClick={() => openPillar(r.id)} onMouseEnter={() => setTip(r.id)} onFocus={() => setTip(r.id)} onBlur={() => setTip(null)}
                  aria-label={`${r.name}: ${fmtScore(r.score)}, ${r.band.label}${r.median != null ? `; index median ${fmtScore(r.median)}, ${diff! >= 0 ? "+" : ""}${fmtScore(diff!)}` : ""}. Show the assessment`}
                  className="perf-card group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3.5 text-left md:grid-cols-[200px_96px_minmax(0,1fr)_48px]">
                  <span className="text-[14.5px] font-medium text-ink">{r.name}</span>
                  <span className="justify-self-end md:justify-self-start"><BandChip label={r.band.label} fill={r.band.fill} /></span>
                  <span aria-hidden className="relative col-span-2 block h-2 rounded-full bg-[var(--line)] md:col-span-1">
                    <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct(r.score)}%`, background: r.band.fill }} />
                    {r.median != null && <span className="absolute -inset-y-1.5 w-[2px] rounded-full bg-ink/70" style={{ left: `calc(${pct(r.median)}% - 1px)` }} />}
                  </span>
                  <span className="hidden text-right text-[18px] font-semibold text-ink num md:block">{fmtScore(r.score)}</span>
                </button>
                {showTip && (
                  <div aria-hidden className="pointer-events-none absolute right-4 top-full z-10 -mt-1 whitespace-nowrap rounded-[4px] border border-line bg-raised px-3 py-2 text-[12.5px] shadow-soft md:left-[calc(200px+96px+2.5rem)] md:right-auto">
                    <span className="font-semibold text-ink num">{fmtScore(r.score)}</span> <span className="text-muted">· {r.band.label}</span>
                    {r.median != null && <span className="ml-2 text-ink-2 num">median {fmtScore(r.median)} · {diff! >= 0 ? "+" : "−"}{fmtScore(Math.abs(diff!))}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted"><span aria-hidden className="inline-block h-3 w-[2px] rounded-full bg-ink/70" />Index median for each pillar · scale {min}–{max}</p>
      </section>

      {/* ── detailed assessments: one card per pillar, summary first, expand for the rest ── */}
      <section id="assessments" aria-labelledby="assess-h" className="scroll-mt-24 py-10">
        <h2 id="assess-h" className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Detailed assessments</h2>
        <p className="mt-1 text-[14px] text-muted">The published rationale for each pillar score, with its sources.</p>
        <ul className="mt-5 grid gap-2.5">
          {rows.map((r) => {
            const isOpen = open.has(r.id);
            return (
              <li key={r.id} id={`a-${r.id}`} className={`assess-card scroll-mt-24 ${isOpen ? "is-open" : ""}`}>
                <button type="button" aria-expanded={isOpen} aria-controls={`a-${r.id}-body`} onClick={() => toggle(r.id)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[16px] font-semibold text-ink">{r.name}</span>
                      {r.band && <BandChip label={r.band.label} fill={r.band.fill} />}
                    </span>
                    {r.rationale && !isOpen && <span className="mt-1.5 line-clamp-2 block text-[14px] leading-relaxed text-muted">{firstSentence(r.rationale)}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[22px] font-semibold leading-none text-ink num">{r.score != null ? fmtScore(r.score) : "—"}</span>
                    <ChevronDown size={16} className={`text-muted transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {isOpen && (
                  <div id={`a-${r.id}-body`} className="grid gap-6 border-t border-line px-5 pb-5 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:gap-10">
                    <div>
                      {r.description && <p className="text-[13px] text-muted">{r.description}</p>}
                      {r.median != null && r.score != null && <p className="mt-1 text-[13px] text-muted num">Index median {fmtScore(r.median)} · {r.score - r.median >= 0 ? "+" : "−"}{fmtScore(Math.abs(Math.round((r.score - r.median) * 10) / 10))}</p>}
                      {r.rationale
                        ? <p className="mt-3 max-w-[72ch] whitespace-pre-line text-[15.5px] leading-[1.75] text-ink-2">{r.rationale}</p>
                        : <p className="mt-3 text-[14.5px] text-muted">No rationale has been published for this score.</p>}
                    </div>
                    <div>
                      <h3 className="label text-muted">Sources{r.references.length > 0 && <span className="num"> · {r.references.length}</span>}</h3>
                      {r.references.length === 0 ? <p className="mt-2 text-[13.5px] text-muted">No sources are listed for this score.</p> : (
                        <ul className="mt-2 grid gap-2.5">
                          {r.references.map((ref, i) => (
                            <li key={i} className="text-[13.5px] leading-snug">
                              {ref.url
                                ? <a href={ref.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 font-medium text-ink hover:text-link"><span className="group-hover:underline group-hover:underline-offset-4">{ref.title || ref.url}</span><ArrowUpRight size={13} className="mt-0.5 shrink-0 text-muted" /><span className="sr-only"> (opens in a new tab)</span></a>
                                : <span className="font-medium text-ink">{ref.title || "Untitled source"}</span>}
                              <span className="mt-0.5 block text-[12px] text-muted">{[ref.publisher, ref.date].filter(Boolean).join(" · ") || "Publisher not stated"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function BandChip({ label, fill }: { label: string; fill: string }) {
  return (
    <span className="score-chip inline-flex h-6 items-center gap-1.5 px-2 text-[12px] font-medium" style={{ "--chip": fill } as React.CSSProperties}>{label}</span>
  );
}

function BandLegend({ bands }: { bands: { label: string; min: number; max: number; fill: string }[] }) {
  return (
    <ul aria-label="Readiness bands" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {bands.map((b) => (
        <li key={b.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: b.fill }} />{b.label} <span className="num">{b.min}–{b.max}</span>
        </li>
      ))}
    </ul>
  );
}
