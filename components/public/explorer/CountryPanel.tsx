"use client";
import Link from "next/link";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import { ArrowRight, Close } from "@/components/ui/icons";
import { ScoreChip } from "../ScoreChip";
import { useExplorer } from "./ExplorerContext";

/** Contextual insight panel beside the map. Nothing is pre-selected: until a visitor
 *  picks a country it offers ways in, drawn from the published data. */
export function CountryPanel() {
  const { summary, byId, selectedId, select, valueOf, rankOf, measure, measureLabel, openScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const c = selectedId ? byId.get(selectedId) : undefined;

  if (!c) {
    const ranked = countries.filter((x) => valueOf(x) != null).sort((a, b) => rankOf(a.country_id) - rankOf(b.country_id));
    const counts = allBands(meta.score_bands).map((b) => ({ b, n: ranked.filter((x) => bandFor(valueOf(x)!, meta.score_bands).index === b.index).length }));
    const list = (title: string, items: typeof ranked, className = "") => (
      <div className={className}>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
        <ol className="mt-2 grid">
          {items.map((x) => (
            <li key={x.country_id}>
              <button type="button" onClick={() => select(x.country_id)} className="flex w-full items-center gap-3 border-b border-line py-2 text-left last:border-0 hover:bg-sunken">
                <span className="w-8 shrink-0 text-xs text-muted num">#{rankOf(x.country_id)}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{x.name}</span>
                <ScoreChip score={valueOf(x)!} bands={meta.score_bands} size="sm" />
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
    return (
      <div className="flex h-full flex-col p-5">
        <p className="text-[15px] font-semibold text-ink">Pick a country to see its breakdown</p>
        <p className="mt-1 text-[13px] text-muted">Select it on the map, search below, or start from these. Showing <span className="font-semibold text-ink-2">{measureLabel}</span>.</p>
        {/* distribution of the active measure across bands */}
        <div className="mt-4">
          <div className="flex h-2 gap-px" aria-hidden>
            {counts.filter((x) => x.n > 0).map((x) => <span key={x.b.label} style={{ flex: x.n, background: x.b.fill }} />)}
          </div>
          <p className="mt-1.5 text-[12px] text-muted num">
            {counts.map((x) => `${x.b.label} ${x.n}`).join(" · ")}
          </p>
        </div>
        {list("Highest", ranked.slice(0, 5), "mt-5")}
        {ranked.length > 8 && list("Lowest", ranked.slice(-3).reverse(), "mt-5 hidden lg:block")}
      </div>
    );
  }

  const rank = rankOf(c.country_id);
  return (
    <div className="flex h-full flex-col p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-muted num">
            {c.iso_code} · #{rank} of {countries.length} on {measureLabel.toLowerCase()}
          </p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">{c.name}</h3>
        </div>
        <button type="button" onClick={() => select(null)} className="grid size-9 shrink-0 place-items-center border border-line-strong bg-raised text-muted hover:text-ink" aria-label={`Clear selection: ${c.name}`}><Close size={16} /></button>
      </div>

      {meta.show_composite && c.composite_score != null && (() => {
        const b = bandFor(c.composite_score, meta.score_bands);
        return (
          <div className="mt-4 flex items-center gap-4 px-4 py-3" style={{ background: b.fill, color: b.ink }}>
            <span className="text-[34px] font-semibold leading-none tracking-tight num">{fmtScore(c.composite_score)}</span>
            <span className="leading-tight"><span className="block text-xs opacity-90">Composite score</span><strong className="text-[17px]">{b.label}</strong></span>
          </div>
        );
      })()}

      <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Pillar breakdown</h4>
      <ul className="mt-1.5 grid">
        {pillars.map((p) => {
          const v = c.scores[p.pillar_id];
          const b = bandFor(v, meta.score_bands);
          const active = measure === p.pillar_id;
          return (
            <li key={p.pillar_id}>
              <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)}
                aria-label={`${p.name}: ${fmtScore(v)}, ${b.label}. Open rationale and sources`}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-1.5 py-2 text-left last:border-0 hover:bg-sunken ${active ? "bg-sunken" : ""}`}>
                <span className={`truncate text-[13.5px] ${active ? "font-semibold text-ink" : "text-ink-2"}`}>{p.name}</span>
                <span className="text-[13.5px] font-semibold text-ink num">{fmtScore(v)} <span className="text-xs font-normal text-muted">{b.label}</span></span>
                <span className="col-span-2 h-1.5 bg-sunken" aria-hidden>
                  <span className="block h-full" style={{ width: `${((v - meta.score_min) / (meta.score_max - meta.score_min)) * 100}%`, background: b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .14)" }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Select a pillar for the rationale and sources.</p>
      <Link href={`/country/${c.slug}`} className="btn mt-auto w-full justify-between max-lg:mt-4">View country profile<span className="box"><ArrowRight size={16} /></span></Link>
    </div>
  );
}
