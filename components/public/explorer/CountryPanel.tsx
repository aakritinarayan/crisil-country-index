"use client";
import Link from "next/link";
import { bandFor, fmtScore } from "@/lib/bands";
import { flagOf } from "@/lib/flag";
import { ArrowRight, Close } from "@/components/ui/icons";
import { kpiScoreLabel } from "@/components/public/country/KpiBreakdown";
import { CountryShape } from "./CountryShape";
import { COMPOSITE, useExplorer } from "./ExplorerContext";

/** Contextual country assessment beside the geographic viewer. Nothing is pre-selected:
 *  until then it is a single invitation. With a selection it follows the assessment tab:
 *    Overview / Composite — the composite score, its band and rank, and every pillar as a
 *      scored bar;
 *    a pillar — that pillar's score, band and rank, and only its parameters (KPIs, on their
 *      own 1–5 scale; a KPI that wasn't assessed says so, never zero).
 *  Every row opens the rationale drawer for its pillar. The country (name, flag, shape) stays
 *  put while the tab changes; only the numbers and the list below swap. No cards, hairlines only. */
export function CountryPanel({ view }: { view: "globe" | "flat" }) {
  const { summary, byId, selectedId, select, rankOf, rankedCount, overview, measure, measureLabel, openScore } = useExplorer();
  const { meta, pillars, kpis, kpiScale, notAssessed } = summary;
  const c = selectedId ? byId.get(selectedId) : undefined;

  if (!c) {
    return (
      <div className="lg:pt-6">
        <p className="label text-muted">Country assessment</p>
        <h3 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Choose a country</h3>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-muted">Its score, performance band and every pillar will appear here.</p>
        {/* three ways in, kept short */}
        <ol className="mt-7 grid gap-3 border-t border-line pt-5 text-[14px] text-ink-2">
          {[
            `Select a country on the ${view === "globe" ? "globe" : "map"}`,
            "Or search by name or ISO code",
            "Colour the map by a pillar to compare",
          ].map((t, i) => (
            <li key={t} className="flex items-baseline gap-3">
              <span className="w-4 shrink-0 text-[12px] font-semibold text-[var(--teal)] num">{i + 1}</span>{t}
            </li>
          ))}
        </ol>
        {notAssessed.length > 0 && (
          <p className="mt-6 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
            Also in the assessment scope, not yet assessed: {notAssessed.map((x) => x.name).join(", ")}.
          </p>
        )}
      </div>
    );
  }

  // what the tab is about: the composite (Overview and Composite), or one pillar
  const pillar = !overview && measure !== COMPOSITE ? pillars.find((p) => p.pillar_id === measure) : undefined;
  const primary = pillar ? c.scores[pillar.pillar_id] ?? null : meta.show_composite ? c.composite_score : null;
  const primaryLabel = pillar ? pillar.name : "Composite";
  const band = primary != null ? bandFor(primary, meta.score_bands) : null;
  const rank = rankOf(c.country_id);
  const flag = flagOf(c.iso_code);
  const params = pillar ? kpis.filter((k) => k.pillar_id === pillar.pillar_id) : [];
  const pct = (v: number) => `${((v - meta.score_min) / (meta.score_max - meta.score_min)) * 100}%`;

  return (
    <div aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label text-muted num">
            {c.iso_code}<span className="mx-2 text-line-strong">/</span>{rank ? <>#{rank} of {rankedCount} · {measureLabel}</> : <>Not ranked · {measureLabel}</>}
          </p>
          <h3 className="mt-2 flex items-center gap-2.5 text-[clamp(1.6rem,2.2vw,1.875rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            {flag && <span aria-hidden className="text-[0.85em] leading-none">{flag}</span>}<span className="min-w-0">{c.name}</span>
          </h3>
        </div>
        <button type="button" onClick={() => select(null)} className="grid size-9 shrink-0 place-items-center text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label={`Clear selection: ${c.name}`}><Close size={16} /></button>
      </div>

      {/* minimal preview: only the country's own silhouette, straight on the panel */}
      <div className="mt-4 h-[200px] w-full">
        <CountryShape key={c.iso_code} iso={c.iso_code} name={c.name} fill="" variant="solo" />
      </div>

      {(pillar || meta.show_composite) && (
        <div className="mt-5 flex min-h-[97px] items-center gap-5 border-y border-line py-5">
          {primary != null && band ? (
            <>
              <span className="text-[56px] font-semibold leading-[.9] tracking-[-0.04em] text-ink num">{fmtScore(primary)}</span>
              <span className="min-w-0 leading-tight">
                <span className="block label text-muted">{primaryLabel}</span>
                <span className="mt-1.5 inline-flex items-center gap-2 text-[17px] font-semibold text-ink">
                  <span aria-hidden className="size-2.5 ring-1 ring-black/10" style={{ background: band.fill }} />{band.label}
                </span>
              </span>
            </>
          ) : (
            <span className="leading-tight">
              <span className="block label text-muted">{primaryLabel}</span>
              <span className="mt-1.5 block text-[15px] font-semibold text-muted">Not available</span>
            </span>
          )}
        </div>
      )}

      <div key={pillar?.pillar_id ?? "all"} className="panel-swap">
        {pillar ? (
          <>
            <h4 className="mt-6 label text-muted">Parameters</h4>
            {params.length === 0 ? <p className="mt-2 text-[13.5px] text-muted">No parameter detail is published for this pillar.</p> : (
              <ul className="mt-2 grid gap-1">
                {params.map((k) => {
                  const s = c.kpis[k.kpi_id] ?? null;
                  const max = kpiScale?.max ?? 5;
                  const label = kpiScale ? kpiScoreLabel(kpiScale.levels, k.by_route, s) : null;
                  const shown = s == null ? null : fmtScore(Math.round(s * 10) / 10);
                  return (
                    <li key={k.kpi_id}>
                      <button type="button" onClick={(e) => openScore(c.country_id, pillar.pillar_id, e.currentTarget)}
                        aria-label={`${k.name}: ${s == null ? "not assessed" : `${shown} out of ${max}${label ? `, ${label}` : ""}`}. Open rationale and sources`}
                        className="group -mx-2 grid w-[calc(100%+16px)] grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 px-2 py-2.5 text-left transition-colors hover:bg-sunken">
                        <span className="text-[14px] leading-snug text-ink-2 group-hover:text-ink">{k.name}</span>
                        {s == null
                          ? <span className="text-[12.5px] text-muted">Not assessed</span>
                          : <span className="whitespace-nowrap text-[14px] font-semibold text-ink num">{shown}<span className="font-normal text-muted"> / {max}</span>{label && <span className="ml-1.5 text-[12px] font-normal text-muted">{label}</span>}</span>}
                        <span className="col-span-2 h-[3px] bg-[var(--line)]" aria-hidden>
                          {s != null && <span className="block h-full bg-[var(--teal)] transition-[width] duration-500" style={{ width: `${(s / max) * 100}%` }} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[12px] text-muted">Parameters are scored {kpiScale?.min ?? 1}–{kpiScale?.max ?? 5}. Select one for its rationale and sources.</p>
          </>
        ) : (
          <>
            <h4 className="mt-6 label text-muted">Pillars</h4>
            <ul className="mt-2 grid gap-1">
              {pillars.map((p) => {
                const v = c.scores[p.pillar_id] ?? null;
                const b = v != null ? bandFor(v, meta.score_bands) : null;
                return (
                  <li key={p.pillar_id}>
                    {/* the whole row opens the rationale drawer */}
                    <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)}
                      aria-label={`${p.name}: ${v != null && b ? `${fmtScore(v)}, ${b.label}` : "not available"}. Open rationale and sources`}
                      className="group -mx-2 grid w-[calc(100%+16px)] grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 px-2 py-2.5 text-left transition-colors hover:bg-sunken">
                      <span className="truncate text-[14px] text-ink-2 group-hover:text-ink">{p.name}</span>
                      {v != null && b
                        ? <span className="text-[14px] font-semibold text-ink num">{fmtScore(v)}<span className="ml-1.5 text-[12px] font-normal text-muted">{b.label}</span></span>
                        : <span className="text-[12.5px] text-muted">Not available</span>}
                      <span className="col-span-2 h-[3px] bg-[var(--line)]" aria-hidden>
                        {v != null && b && <span className="block h-full transition-[width] duration-500" style={{ width: pct(v), background: b.fill, boxShadow: "inset 0 0 0 .5px rgb(0 0 0 / .18)" }} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[12px] text-muted">Select a pillar for its rationale and sources.</p>
          </>
        )}
      </div>
      <Link href={`/country/${c.slug}`} className="btn mt-7 w-full justify-between">View country profile<span className="box"><ArrowRight size={16} /></span></Link>
    </div>
  );
}
