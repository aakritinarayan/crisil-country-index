"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { allBands, bandFor, fmtScore } from "@/lib/bands";
import { ArrowRight, Close } from "@/components/ui/icons";
import { CountryCombobox } from "../CountryCombobox";
import { ScoreChip } from "../ScoreChip";
import { useExplorer, type SummaryCountry } from "./ExplorerContext";
import { WorldMap, type MapItem } from "./WorldMap";

const COMPOSITE = "__composite";

export function MapSection() {
  const { summary, byId, openScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const bands = allBands(meta.score_bands);
  const [metric, setMetric] = useState<string>(meta.show_composite ? COMPOSITE : pillars[0].pillar_id);
  const [active, setActive] = useState<Set<number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const valueOf = (c: SummaryCountry) => (metric === COMPOSITE ? c.composite_score : c.scores[metric] ?? null);
  const metricLabel = metric === COMPOSITE ? "Composite score" : pillars.find((p) => p.pillar_id === metric)!.name;

  const items: MapItem[] = useMemo(() => {
    // rank within the chosen metric, so the tooltip rank matches what is coloured
    const vals = countries.map((c) => ({ c, v: metric === COMPOSITE ? c.composite_score : c.scores[metric] ?? null }));
    const sorted = vals.filter((x) => x.v != null).sort((a, b) => b.v! - a.v!);
    const rank = new Map<string, number>();
    sorted.forEach((x, i) => rank.set(x.c.country_id, i > 0 && sorted[i - 1].v === x.v ? rank.get(sorted[i - 1].c.country_id)! : i + 1));
    return vals.map(({ c, v }) => ({ id: c.country_id, iso: c.iso_code, name: c.name, value: v, rank: rank.get(c.country_id) ?? 0 }));
  }, [countries, metric]);

  const counts = bands.map((b) => items.filter((i) => i.value != null && bandFor(i.value, meta.score_bands).index === b.index).length);
  const toggleBand = (i: number) => setActive((cur) => {
    const next = new Set(cur ?? []);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next.size === 0 || next.size === bands.length ? null : next;
  });

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const top = [...items].filter((i) => i.value != null).sort((a, b) => a.rank - b.rank).slice(0, 5);
  const options = countries.map(({ country_id, name, slug, iso_code, composite_score, rank }) => ({ country_id, name, slug, iso_code, composite_score, rank }));

  return (
    <section id="map" aria-labelledby="map-h" className="wrap scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="map-h" className="t-h3">Explore {countries.length} countries</h2>
          <p className="mt-1 text-muted">Colour the map by the composite score or by any pillar. Select a country for its breakdown.</p>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="metric" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">Colour by</label>
          <select id="metric" value={metric} onChange={(e) => setMetric(e.target.value)}
            className="h-11 w-full border border-line-strong bg-raised px-3 pr-8 text-[15px] font-medium text-ink sm:w-72">
            {meta.show_composite && <option value={COMPOSITE}>Composite score</option>}
            {pillars.map((p) => <option key={p.pillar_id} value={p.pillar_id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 border border-line bg-raised shadow-soft">
        <div className="relative">
          <WorldMap items={items} bands={meta.score_bands} activeBands={active} selectedId={selectedId} onSelect={setSelectedId} metricLabel={metricLabel} />

          {/* info panel — floats over the map on wide screens, sits below it on small ones */}
          <aside aria-live="polite" className="border-t border-line bg-raised p-5 lg:absolute lg:bottom-4 lg:left-4 lg:w-[340px] lg:border lg:shadow-lift">
            {selected ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-muted">{selected.iso_code} · RANK #{selected.rank} OF {countries.length}</p>
                    <h3 className="mt-1 text-xl font-bold tracking-tight text-ink">{selected.name}</h3>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="grid size-8 shrink-0 place-items-center text-muted hover:text-ink" aria-label="Clear selected country"><Close size={16} /></button>
                </div>
                {selected.composite_score != null && meta.show_composite && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">Composite <ScoreChip score={selected.composite_score} bands={meta.score_bands} /></p>
                )}
                <ul className="mt-4 grid gap-1.5">
                  {pillars.map((p) => {
                    const v = selected.scores[p.pillar_id];
                    const b = bandFor(v, meta.score_bands);
                    return (
                      <li key={p.pillar_id}>
                        <button type="button" onClick={(e) => openScore(selected.country_id, p.pillar_id, e.currentTarget)}
                          className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-2 py-1.5 text-left hover:bg-sunken"
                          aria-label={`${p.name}: ${fmtScore(v)}, ${b.label}. Open rationale and sources`}>
                          <span className="truncate text-[13px] text-ink-2 group-hover:text-ink">{p.name}</span>
                          <span className="text-[13px] font-semibold num text-ink">{fmtScore(v)} <span className="font-normal text-muted">{b.label}</span></span>
                          <span className="col-span-2 h-1.5 bg-sunken" aria-hidden>
                            <span className="block h-full" style={{ width: `${((v - meta.score_min) / (meta.score_max - meta.score_min)) * 100}%`, background: b.fill , boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .14)" }} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Link href={`/country/${selected.slug}`} className="btn mt-4 w-full justify-between">Open country profile<span className="box"><ArrowRight size={16} /></span></Link>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Highest · {metricLabel}</p>
                <ol className="mt-3 grid gap-1">
                  {top.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSelectedId(t.id)} className="flex w-full items-center gap-3 px-2 py-1.5 text-left hover:bg-sunken">
                        <span className="w-6 text-xs text-muted num">#{t.rank}</span>
                        <span className="flex-1 truncate text-[14px] font-medium text-ink">{t.name}</span>
                        <ScoreChip score={t.value!} bands={meta.score_bands} size="sm" />
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 px-2 text-xs text-muted">Select any country on the map, or search below.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="flex flex-col gap-4 border-t border-line p-4 lg:flex-row lg:items-center">
          <CountryCombobox countries={options} bands={meta.score_bands} onSelect={(c) => setSelectedId(c.country_id)} className="lg:w-80" />
          <fieldset className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:ml-auto">
            <legend className="sr-only">Show score bands</legend>
            {bands.map((b, i) => {
              const on = !active || active.has(i);
              return (
                <button key={b.label} type="button" aria-pressed={!!active && active.has(i)} onClick={() => toggleBand(i)}
                  className={`flex items-center gap-2 border py-1 pl-1 pr-3 text-[13px] transition-opacity ${on ? "border-line-strong bg-raised" : "border-line bg-transparent opacity-50"} ${active?.has(i) ? "ring-2 ring-ink" : ""}`}>
                  <span className="px-2 py-0.5 font-semibold num" style={{ background: b.fill, color: b.ink }}>{b.min}–{b.max}</span>
                  <span className="font-semibold text-ink">{b.label}</span>
                  <span className="text-muted num">{counts[i]}</span>
                </button>
              );
            })}
            {active && <button type="button" onClick={() => setActive(null)} className="px-2 text-[13px] font-semibold text-link underline underline-offset-4">Show all</button>}
          </fieldset>
        </div>
      </div>
    </section>
  );
}
