"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import type { Country, Score } from "@/lib/types";
import { ArrowLeft, ArrowRight, ArrowUpRight, Close } from "@/components/ui/icons";
import { useExplorer } from "./ExplorerContext";

type Detail = { country: Country; scores: Score[] };
const cache = new Map<string, Promise<Detail>>();
const load = (slug: string) => {
  if (!cache.has(slug)) cache.set(slug, fetch(`/data/country/${slug}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }));
  return cache.get(slug)!;
};

/** Slide-over score detail. A modal <dialog> gives focus trapping, Escape to close
 *  and an inert page behind it natively; the matrix stays visible under the scrim. */
export function ScoreDrawer({ target, onClose, onNavigate }: {
  target: { countryId: string; pillarId: string } | null; onClose: () => void; onNavigate: (pillarId: string) => void;
}) {
  const { summary, byId } = useExplorer();
  const ref = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);
  const country = target ? byId.get(target.countryId) : undefined;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  useEffect(() => {
    if (!country) return;
    let live = true;
    setError(false);
    load(country.slug).then((x) => live && setDetail(x)).catch(() => live && setError(true));
    return () => { live = false; };
  }, [country]);

  const pillars = summary.pillars;
  const pi = target ? pillars.findIndex((p) => p.pillar_id === target.pillarId) : -1;
  const pillar = pillars[pi];
  const value = country && pillar ? country.scores[pillar.pillar_id] : undefined;
  const band = value != null ? bandFor(value, summary.meta.score_bands) : null;
  const s = detail && country && detail.country.country_id === country.country_id ? detail.scores.find((x) => x.pillar_id === target?.pillarId) : undefined;
  const prev = pillars[(pi - 1 + pillars.length) % pillars.length];
  const next = pillars[(pi + 1) % pillars.length];
  const { score_min: lo, score_max: hi } = summary.meta;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="drawer-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="drawer m-0 ml-auto h-dvh max-h-none w-full max-w-[540px] bg-transparent p-0 backdrop:bg-[var(--scrim)]">
      {country && pillar && band && value != null && (
        <div className="flex h-full flex-col border-l border-line bg-bg text-ink shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-6 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Score detail</p>
            <button type="button" onClick={onClose} className="grid size-10 place-items-center border border-line-strong bg-raised hover:shadow-soft" aria-label="Close score detail"><Close /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
              <span className="border border-line-strong px-1.5 py-0.5 text-[11px] tracking-wider">{country.iso_code}</span>
              {country.name}<span className="font-normal text-muted">· ranked #{country.rank} of {summary.countries.length}</span>
            </p>
            <h2 id="drawer-title" className="t-h3 mt-3">{pillar.name}</h2>

            <div className="mt-5 flex items-center gap-5 px-5 py-4" style={{ background: band.fill, color: band.ink }}>
              <span className="text-[56px] font-semibold leading-none tracking-tight num">{fmtScore(value)}</span>
              <span className="flex flex-col">
                <strong className="text-xl">{band.label}</strong>
                <span className="text-sm">{band.min}–{band.max} band · scale {lo}–{hi}</span>
              </span>
            </div>
            {/* where the score sits on the full scale */}
            <div className="relative mt-3 flex h-6 gap-0.5" aria-hidden>
              {allBands(summary.meta.score_bands).map((b) => (
                <span key={b.label} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold"
                  style={{ flex: b.max - b.min + 1, background: b.fill, color: b.ink, opacity: b.index === band.index ? 1 : 0.55 }}><span className="hidden truncate px-1 sm:inline">{b.label}</span></span>
              ))}
              <span className="absolute -inset-y-1.5 w-1 -translate-x-1/2 bg-ink ring-2 ring-bg" style={{ left: `${pct(value)}%` }} />
            </div>

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Why this score</h3>
            {error ? <p className="mt-3 text-muted">The rationale could not be loaded. Check your connection and open the score again.</p>
              : s ? <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{s.rationale}</p>
              : <div className="mt-3 space-y-2" aria-label="Loading">{[100, 94, 70].map((w) => <div key={w} className="h-3.5 animate-pulse bg-sunken" style={{ width: `${w}%` }} />)}</div>}

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Sources {s && `(${s.references.length})`}</h3>
            {s && (s.references.length === 0 ? <p className="mt-3 text-muted">No sources are listed for this score.</p> : (
              <ul className="mt-3 grid gap-2">
                {s.references.map((r) => (
                  <li key={r.url + r.title}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 border border-line bg-raised px-4 py-3 hover:border-line-strong hover:shadow-soft">
                      <span className="flex-1">
                        <span className="block font-semibold text-ink">{r.title}</span>
                        <span className="text-[13px] text-muted">{[r.publisher, r.published_date && new Date(r.published_date).toLocaleString("en-GB", { month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</span>
                      </span>
                      <ArrowUpRight className="text-link" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ))}
          </div>

          <div className="border-t border-line px-6 py-4">
            <div className="flex justify-between gap-2">
              <button type="button" onClick={() => onNavigate(prev.pillar_id)} className="flex min-w-0 items-center gap-2 border border-line-strong bg-raised px-3 py-2 text-sm hover:shadow-soft">
                <ArrowLeft size={16} /><span className="truncate">{prev.name}</span>
              </button>
              <button type="button" onClick={() => onNavigate(next.pillar_id)} className="flex min-w-0 items-center gap-2 border border-line-strong bg-raised px-3 py-2 text-sm hover:shadow-soft">
                <span className="truncate">{next.name}</span><ArrowRight size={16} />
              </button>
            </div>
            <Link href={`/country/${country.slug}`} className="btn mt-3 w-full justify-between">
              View full {country.name} profile<span className="box"><ArrowRight size={16} /></span>
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
