"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import type { CountryDetail } from "@/lib/data";
import { KpiBreakdown } from "@/components/public/country/KpiBreakdown";
import { ArrowLeft, ArrowRight, ArrowUpRight, Close } from "@/components/ui/icons";
import { Loading, Skel, SkelText } from "@/components/ui/Skeleton";
import { useExplorer } from "./ExplorerContext";

type Detail = Pick<CountryDetail, "country" | "scores" | "kpis">;
const cache = new Map<string, Promise<Detail>>();
const load = (slug: string) => {
  if (!cache.has(slug)) cache.set(slug, fetch(`/data/country/${slug}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }));
  return cache.get(slug)!;
};

/** Score rationale: quick investigation without leaving the page. A modal <dialog> gives
 *  focus trapping, Escape and an inert page natively; closing returns focus to the score
 *  that opened it (ExplorerContext). Editorial, not carded: country and pillar, the score
 *  with its band and range, a thin scale with a marker, the published rationale, sources as
 *  plain links, previous / next pillar (the dialog stays open), and the full assessment. */
export function ScoreDrawer({ target, onClose, onNavigate }: {
  target: { countryId: string; pillarId: string } | null; onClose: () => void; onNavigate: (pillarId: string) => void;
}) {
  const { summary, byId } = useExplorer();
  const ref = useRef<HTMLDialogElement>(null);
  // fetch result keyed by country slug; only written from the async callbacks
  const [result, setResult] = useState<{ slug: string; detail?: Detail; failed?: boolean } | null>(null);
  const country = target ? byId.get(target.countryId) : undefined;
  const detail = result && country && result.slug === country.slug ? result.detail ?? null : null;
  const error = !!(result && country && result.slug === country.slug && result.failed);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  useEffect(() => {
    if (!country) return;
    let live = true;
    const slug = country.slug;
    load(slug).then((x) => live && setResult({ slug, detail: x })).catch(() => live && setResult({ slug, failed: true }));
    return () => { live = false; };
  }, [country]);

  const pillars = summary.pillars;
  const pi = target ? pillars.findIndex((p) => p.pillar_id === target.pillarId) : -1;
  const pillar = pillars[pi];
  const value = country && pillar ? country.scores[pillar.pillar_id] ?? null : null;
  const band = value != null ? bandFor(value, summary.meta.score_bands) : null;
  const s = detail && country && detail.country.country_id === country.country_id ? detail.scores.find((x) => x.pillar_id === target?.pillarId) : undefined;
  const prev = pi > 0 ? pillars[pi - 1] : null;
  const next = pi >= 0 && pi < pillars.length - 1 ? pillars[pi + 1] : null;
  const { score_min: lo, score_max: hi } = summary.meta;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  // leaving for the profile: let the rankings remember how they were being browsed
  const remember = () => window.dispatchEvent(new Event("rankings:remember"));

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="drawer-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="drawer m-0 ml-auto h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[var(--scrim)] sm:max-w-[480px]">
      {country && pillar && (
        <div className="drawer-panel flex h-full flex-col border-l border-line bg-bg text-ink shadow-lift">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5 sm:px-7">
            <div className="min-w-0">
              <p className="text-[13px] text-muted num">{country.name} <span className="text-line-strong">·</span> {country.iso_code}</p>
              <h2 id="drawer-title" className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">{pillar.name}</h2>
            </div>
            <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Close score rationale"><Close /></button>
          </div>

          <div className="drawer-body flex-1 overflow-y-auto px-6 pb-8 sm:px-7">
            {value != null && band ? (
              <>
                {/* the score, its band and range, then where it sits on the full scale */}
                <div className="flex items-end gap-4 border-t border-line pt-5">
                  <span className="text-[52px] font-semibold leading-[.9] tracking-[-0.03em] text-ink num">{fmtScore(value)}</span>
                  <span className="pb-1 leading-tight">
                    <span className="flex items-center gap-2 text-[16px] font-semibold text-ink">
                      <span aria-hidden className="score-chip inline-block h-3.5 w-5" style={{ "--chip": band.fill } as React.CSSProperties} />{band.label}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-muted num">{band.min}–{band.max} band · scale {lo}–{hi}</span>
                  </span>
                </div>
                <div className="relative mt-5" aria-hidden>
                  <div className="flex h-1.5 gap-px">
                    {allBands(summary.meta.score_bands).map((b) => (
                      <span key={b.label} style={{ flex: b.max - b.min + 1, background: b.fill, opacity: b.index === band.index ? 1 : 0.45 }} />
                    ))}
                  </div>
                  <span className="absolute -top-1 h-3.5 w-[3px] -translate-x-1/2 bg-ink ring-2 ring-bg" style={{ left: `${pct(value)}%` }} />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted num"><span>{lo}</span><span>{hi}</span></div>
                </div>
              </>
            ) : (
              <p className="border-t border-line pt-5 text-[15px] text-muted">No score is published for {country.name} on this pillar.</p>
            )}

            {!detail && !error ? (
              // the country's evidence is loading: the shape of what comes, under no heading
              // yet (it depends on the data: indicators, or a rationale and sources)
              <Loading label="Loading the evidence for this score" className="mt-8">
                <Skel className="h-3 w-40" />
                <div className="mt-4 grid gap-5 border-t border-line pt-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid gap-2">
                      <div className="flex items-center justify-between gap-4"><Skel className="h-4 w-3/5" /><Skel className="h-5 w-12" /></div>
                      <SkelText widths={[100, 82]} line="h-3" gap="gap-2" />
                    </div>
                  ))}
                </div>
              </Loading>
            ) : detail?.kpis && target ? (
              <>
                <h3 className="label mt-8 text-muted">What the score is built from</h3>
                <div className="mt-3"><KpiBreakdown kpis={detail.kpis.byPillar[target.pillarId] ?? []} levels={detail.kpis.levels} max={detail.kpis.max} compact /></div>
              </>
            ) : <>
            <h3 className="label mt-8 text-muted">Why this score</h3>
            {error ? <p className="mt-2 text-[15px] text-muted">The rationale could not be loaded. Check your connection and open the score again.</p>
              : s ? <p className="mt-2 whitespace-pre-line text-[15.5px] leading-[1.7] text-ink-2">{s.rationale}</p>
              : <p className="mt-2 text-[15px] text-muted">No rationale is published for this score.</p>}

            <h3 className="label mt-8 text-muted">Sources{s && s.references.length > 0 && <span className="num"> · {s.references.length}</span>}</h3>
            {s && (s.references.length === 0 ? <p className="mt-2 text-[14px] text-muted">No sources are listed for this score.</p> : (
              <ul className="mt-2 border-t border-line">
                {s.references.map((r) => (
                  <li key={r.url + r.title} className="border-b border-line">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 py-3 hover:bg-sunken/50">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium leading-snug text-ink group-hover:text-link group-hover:underline group-hover:underline-offset-4">{r.title}</span>
                        <span className="mt-0.5 block text-[12.5px] text-muted">{[r.publisher, r.published_date && new Date(r.published_date).toLocaleString("en-GB", { month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</span>
                      </span>
                      <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-muted group-hover:text-link" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ))}
            </>}
          </div>

          <div className="border-t border-line px-6 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-3 text-[13.5px]">
              {prev ? (
                <button type="button" onClick={() => onNavigate(prev.pillar_id)} className="flex min-w-0 items-center gap-1.5 py-1.5 text-ink-2 hover:text-ink" aria-label={`Previous pillar: ${prev.name}`}>
                  <ArrowLeft size={15} className="shrink-0" /><span className="truncate">{prev.name}</span>
                </button>
              ) : <span />}
              {next ? (
                <button type="button" onClick={() => onNavigate(next.pillar_id)} className="flex min-w-0 items-center gap-1.5 py-1.5 text-right text-ink-2 hover:text-ink" aria-label={`Next pillar: ${next.name}`}>
                  <span className="truncate">{next.name}</span><ArrowRight size={15} className="shrink-0" />
                </button>
              ) : <span />}
            </div>
            <Link href={`/country/${country.slug}`} onClick={remember} className="btn mt-3 w-full justify-between">
              View full country assessment<span className="box"><ArrowRight size={16} /></span>
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
