"use client";
import { useEffect, useId, useState } from "react";
import { fmtScore } from "@/lib/bands";
import { ArrowUpRight, ChevronDown } from "@/components/ui/icons";

export type PillarRow = {
  id: string; name: string; description: string;
  score: number | null; median: number | null;
  band: { label: string; min: number; max: number; fill: string } | null;
  rationale: string;
  references: { title: string; publisher: string; date: string | null; url: string | null }[];
};
type Band = { label: string; min: number; max: number; fill: string };

const diffOf = (r: PillarRow) => (r.score != null && r.median != null ? Math.round((r.score - r.median) * 10) / 10 : null);
const signed = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmtScore(Math.abs(d))}`;

/** Pillar performance and its assessments in one place. The chart is the navigation:
 *  every pillar is a row (name, score, bar on the workbook scale, a marker at that
 *  pillar's own index median); choosing one shows its score, band, benchmark, the
 *  published rationale and sources beside the chart — no scrolling, no accordions.
 *  Below md the rows expand in place instead. The first scored pillar starts selected;
 *  a #pillar-id in the address selects that one. Text is shown exactly as published. */
export function PillarExplorer({ rows, min, max, legend }: { rows: PillarRow[]; min: number; max: number; legend: Band[] }) {
  const uid = useId();
  const first = (rows.find((r) => r.score != null) ?? rows[0])?.id ?? null;
  const [selected, setSelected] = useState<string | null>(first);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [tip, setTip] = useState<string | null>(null);
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const current = rows.find((r) => r.id === selected) ?? null;

  // one-off sync from the URL after hydration; selects (and expands on phones), never scrolls
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (!h || !rows.some((r) => r.id === h)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(h);
    setExpanded(new Set([h]));
  }, [rows]);

  const choose = (id: string) => { setSelected(id); window.history.replaceState(null, "", `#${id}`); };
  const toggle = (id: string) => setExpanded((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const label = (r: PillarRow) => r.score == null || !r.band ? `${r.name}: not scored`
    : `${r.name}: ${fmtScore(r.score)} out of ${max}, ${r.band.label}${r.median != null ? `; index median ${fmtScore(r.median)}, ${signed(diffOf(r)!)}` : ""}`;

  // the row's visual content: name and score, then the bar with the median marker
  const rowBody = (r: PillarRow, active: boolean) => (
    <>
      <span className="flex items-baseline justify-between gap-4">
        <span className={`min-w-0 text-[14.5px] leading-snug ${active ? "font-semibold text-ink" : "font-medium text-ink-2 group-hover:text-ink"}`}>{r.name}</span>
        {r.score != null
          ? <span className={`shrink-0 text-[17px] leading-none text-ink num transition-[font-weight] ${active ? "font-bold" : "font-semibold"}`}>{fmtScore(r.score)}</span>
          : <span className="shrink-0 text-[12.5px] text-muted">Not scored</span>}
      </span>
      <span aria-hidden className="pillar-track relative mt-2.5 block h-2 rounded-[3px]">
        {r.score != null && r.band && <span className="pillar-fill absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${pct(r.score)}%`, background: r.band.fill }} />}
        {r.median != null && <span className="absolute -inset-y-1 w-[2px] rounded-full bg-ink/70" style={{ left: `calc(${pct(r.median)}% - 1px)` }} />}
      </span>
    </>
  );

  const tooltip = (r: PillarRow) => r.score != null && r.band && (
    <div aria-hidden className="pillar-tip pointer-events-none absolute left-4 top-[calc(100%-4px)] z-20 whitespace-nowrap rounded-[4px] border border-line bg-raised px-3 py-2 text-[12.5px] shadow-soft">
      <span className="font-semibold text-ink">{r.name}</span>
      <span className="mt-0.5 block text-ink-2 num">
        {fmtScore(r.score)} · {r.band.label}
        {r.median != null && <> · median {fmtScore(r.median)} · <span className="font-semibold text-ink">{signed(diffOf(r)!)}</span></>}
      </span>
    </div>
  );

  return (
    <section id="performance" aria-labelledby="perf-h" className="scroll-mt-24 border-t border-line py-10">
      <h2 id="perf-h" className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Pillar performance</h2>
      <p className="mt-1 text-[14px] text-muted">Explore each pillar&rsquo;s performance, rationale and supporting evidence.</p>

      {/* ── md and up: chart (navigation) left, the selected pillar's assessment right ── */}
      <div className="mt-6 hidden gap-8 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div>
          <ul className="grid gap-1" onMouseLeave={() => setTip(null)}>
            {rows.map((r) => {
              const active = r.id === selected;
              return (
                <li key={r.id} className="relative">
                  <button type="button" aria-pressed={active} aria-controls={`${uid}-panel`} aria-label={label(r)}
                    onClick={() => choose(r.id)} onMouseEnter={() => setTip(r.id)} onFocus={() => setTip(r.id)} onBlur={() => setTip(null)}
                    className={`pillar-row group block w-full px-4 py-3.5 text-left ${active ? "is-active" : ""}`}>
                    {rowBody(r, active)}
                  </button>
                  {tip === r.id && tooltip(r)}
                </li>
              );
            })}
          </ul>
          <Legend bands={legend} />
        </div>

        <div id={`${uid}-panel`} className="pillar-panel min-w-0">
          {current ? <Detail key={current.id} r={current} max={max} /> : <p className="text-[14.5px] text-muted">No pillars are published.</p>}
        </div>
      </div>

      {/* ── phones: each row expands in place ── */}
      <ul className="mt-5 grid gap-1 md:hidden">
        {rows.map((r) => {
          const open = expanded.has(r.id);
          return (
            <li key={r.id} className={`pillar-m ${open ? "is-open" : ""}`}>
              <button type="button" aria-expanded={open} aria-controls={`${uid}-m-${r.id}`} aria-label={label(r)} onClick={() => toggle(r.id)}
                className="group flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="min-w-0 flex-1">{rowBody(r, open)}</span>
                <ChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <div id={`${uid}-m-${r.id}`} className="border-t border-line px-4 pb-5 pt-4"><Detail r={r} max={max} compact /></div>}
            </li>
          );
        })}
      </ul>
      <div className="md:hidden"><Legend bands={legend} /></div>
    </section>
  );
}

/** One pillar's assessment: identity, score and band, benchmark, rationale, sources. */
function Detail({ r, max, compact = false }: { r: PillarRow; max: number; compact?: boolean }) {
  const d = diffOf(r);
  return (
    <div className="pillar-detail">
      {!compact && (
        <>
          <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.015em] text-ink">{r.name}</h3>
          {r.description && <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-muted">{r.description}</p>}
        </>
      )}
      {compact && r.description && <p className="text-[13.5px] leading-relaxed text-muted">{r.description}</p>}

      {/* score, band, benchmark */}
      <div className={`flex flex-wrap items-end gap-x-8 gap-y-3 ${compact ? "mt-3" : "mt-5 border-y border-line py-4"}`}>
        {r.score != null && r.band ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-ink num">{fmtScore(r.score)}</span>
              <span className="text-[14px] text-muted num">/ {max}</span>
            </p>
            <p className="pb-0.5">
              <span className="block text-[12px] text-muted">Readiness</span>
              <span className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span aria-hidden className="band-dot" style={{ "--chip": r.band.fill } as React.CSSProperties} />{r.band.label}
                <span className="text-[12.5px] font-normal text-muted num">{r.band.min}–{r.band.max}</span>
              </span>
            </p>
            <p className="pb-0.5">
              <span className="block text-[12px] text-muted">Index median</span>
              {r.median != null && d != null
                ? <span className="mt-0.5 block text-[15px] text-ink num"><span className="font-semibold">{fmtScore(r.median)}</span> <span className="text-ink-2">· {d === 0 ? "level with the median" : `${signed(d)} points ${d > 0 ? "above" : "below"}`}</span></span>
                : <span className="mt-0.5 block text-[14px] text-muted">Not available</span>}
            </p>
          </>
        ) : <p className="text-[14.5px] text-muted">No score is published for this pillar.</p>}
      </div>

      <h4 className="label mt-6 text-muted">Assessment rationale</h4>
      {r.rationale
        ? <p className="mt-2 max-w-[70ch] whitespace-pre-line text-[15.5px] leading-[1.75] text-ink-2">{r.rationale}</p>
        : <p className="mt-2 text-[14.5px] text-muted">No rationale has been published for this score.</p>}

      <h4 className="label mt-7 text-muted">Supporting sources{r.references.length > 0 && <span className="num"> · {r.references.length}</span>}</h4>
      {r.references.length === 0 ? <p className="mt-2 text-[14px] text-muted">No sources are listed for this score.</p> : (
        <ul className="mt-2 border-t border-line">
          {r.references.map((ref, i) => (
            <li key={i} className="border-b border-line py-3 text-[14px] leading-snug">
              {ref.url
                ? <a href={ref.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 font-medium text-ink transition-colors hover:text-link">
                    <span className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] group-hover:decoration-current">{ref.title || ref.url}</span>
                    <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-muted group-hover:text-link" /><span className="sr-only"> (opens in a new tab)</span>
                  </a>
                : <span className="font-medium text-ink">{ref.title || "Untitled source"}</span>}
              <span className="mt-0.5 block text-[12.5px] text-muted">{[ref.publisher, ref.date].filter(Boolean).join(" · ") || "Publisher not stated"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legend({ bands }: { bands: Band[] }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-4 text-[12px] text-muted">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-[2px] rounded-full bg-ink/70" />Index median</span>
      {bands.map((b) => (
        <span key={b.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="band-dot" style={{ "--chip": b.fill } as React.CSSProperties} />{b.label}
        </span>
      ))}
    </div>
  );
}
