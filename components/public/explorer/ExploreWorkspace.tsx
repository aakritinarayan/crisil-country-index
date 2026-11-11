"use client";
import { useMemo } from "react";
import { allBands, bandFor } from "@/lib/bands";
import { CountryCombobox } from "../CountryCombobox";
import { CountryPanel } from "./CountryPanel";
import { useExplorer } from "./ExplorerContext";
import { PillarSelector } from "./PillarSelector";
import { WorldMap, type MapItem } from "./WorldMap";

/** Country exploration workspace: measure selector, map (left), insight panel (right),
 *  search + band filter. All state comes from ExplorerContext, shared with Rankings. */
export function ExploreWorkspace() {
  const { summary, selectedId, select, valueOf, rankOf, measureLabel, overview, bandFilter, toggleBand, clearBands } = useExplorer();
  const { meta, countries } = summary;
  const bands = allBands(meta.score_bands);

  const items: MapItem[] = useMemo(
    () => countries.map((c) => ({ id: c.country_id, iso: c.iso_code, name: c.name, value: valueOf(c), rank: rankOf(c.country_id) })),
    [countries, valueOf, rankOf],
  );
  const missing = items.filter((i) => i.value == null).length;
  const counts = bands.map((b) => items.filter((i) => i.value != null && bandFor(i.value, meta.score_bands).index === b.index).length);
  const options = useMemo(() => countries.map(({ country_id, name, slug, iso_code, composite_score, rank }) => ({ country_id, name, slug, iso_code, composite_score, rank })), [countries]);

  return (
    <section id="map" aria-labelledby="explore-h" className="wrap scroll-mt-20">
      <div>
        <span className="eyebrow">Explore the index</span>
        <h2 id="explore-h" className="t-h2 mt-4">{countries.length} countries, <span className="grad-text">one map</span></h2>
      </div>

      {/* controls sit directly on the page above the map: no card around them */}
      <div className="mt-8 min-w-0">
        <PillarSelector />
      </div>

      <div className="mt-3 grid border border-line bg-raised lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:grid-rows-[1fr_auto]">
        <div className="order-1 min-w-0 p-2 sm:p-4 lg:order-none lg:col-start-1 lg:row-start-1">
          <WorldMap items={items} bands={meta.score_bands} activeBands={overview ? null : bandFilter} selectedId={selectedId} onSelect={select} metricLabel={measureLabel} neutral={overview} />
        </div>

        <div className="order-3 flex min-w-0 flex-col gap-3 border-t border-line p-4 lg:order-none lg:col-start-1 lg:row-start-2 xl:flex-row xl:items-center">
          <CountryCombobox countries={options} bands={meta.score_bands} onSelect={(c) => select(c.country_id)} className="xl:w-72 xl:shrink-0" />
          {overview ? (
            <ul aria-label="Map legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2 xl:ml-auto">
              <li className="flex items-center gap-2"><span aria-hidden className="size-3.5 border border-line-strong bg-[var(--map-assessed)]" />Assessed <span className="font-semibold text-ink num">{countries.length}</span></li>
              <li className="flex items-center gap-2"><span aria-hidden className="size-3.5 border border-line bg-[var(--map-unassessed)]" />Not assessed</li>
              <li className="text-muted">Choose a measure above to colour by score</li>
            </ul>
          ) : (
          <fieldset className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center xl:ml-auto">
            <legend className="sr-only">Filter by score band ({measureLabel})</legend>
            {bands.map((b, i) => {
              const pressed = !!bandFilter?.has(i);
              const on = !bandFilter || pressed;
              return (
                <button key={b.label} type="button" aria-pressed={pressed} onClick={() => toggleBand(i)}
                  className={`flex h-8 items-center gap-1.5 border pr-2.5 text-[12.5px] ${pressed ? "border-ink ring-1 ring-ink" : "border-line-strong"} ${on ? "bg-raised" : "bg-transparent opacity-45"}`}>
                  <span className="flex h-full items-center px-1.5 font-semibold num" style={{ background: b.fill, color: b.ink }}>{b.min}–{b.max}</span>
                  <span className="font-semibold text-ink">{b.label}</span>
                  <span className="text-muted num">{counts[i]}</span>
                </button>
              );
            })}
            {missing > 0 && <span className="flex h-8 items-center gap-1.5 px-1 text-[12.5px] text-muted"><span aria-hidden className="size-3.5 border border-line-strong bg-[var(--map-assessed)]" />No score <span className="num">{missing}</span></span>}
            {bandFilter && <button type="button" onClick={clearBands} className="h-8 px-2 text-[12.5px] font-semibold text-link underline underline-offset-4">Show all</button>}
          </fieldset>
          )}
        </div>

        <aside aria-label="Country insight" className="order-2 min-w-0 border-t lg:order-none border-line lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0">
          <CountryPanel />
        </aside>
      </div>
    </section>
  );
}
