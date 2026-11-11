import { allBands, bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";

/** Below this many composite scores a histogram is mostly empty bins and says less
 *  than "rank N of M" does, so the page leaves it out. A display heuristic, not data. */
export const HISTOGRAM_MIN_COUNTRIES = 12;

/** "Against the index": every country's composite score as a soft histogram on the full
 *  scale, bars tinted by band. The country is a fine ink line with its score; the index
 *  median a dashed line; the band strip underneath doubles as the legend. All values
 *  come from the published composites. */
export function CompositeHistogram({ values, score, median, bands, min, max, countryName }: {
  values: number[]; score: number; median: number | null; bands: ScoreBand[]; min: number; max: number; countryName: string;
}) {
  const n = values.length;
  const binCount = 20;
  const w = (max - min) / binCount;
  const binOf = (v: number) => Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / w)));
  const counts = Array.from({ length: binCount }, () => 0);
  values.forEach((v) => counts[binOf(v)]++);
  const peak = Math.max(...counts, 1);
  const mine = binOf(score);
  const below = values.filter((v) => v < score).length;
  const pctBelow = Math.round((below / n) * 100);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const all = allBands(bands);

  return (
    <figure>
      <div role="img" className="relative"
        aria-label={`Composite scores of ${n} countries on a ${min} to ${max} scale. ${countryName} scores ${fmtScore(score)}, higher than ${pctBelow}% of countries${median != null ? `; the index median is ${fmtScore(median)}` : ""}.`}>
        {/* markers above the bars */}
        <div aria-hidden className="relative h-9">
          <span className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(score)}%` }}>
            <span className="whitespace-nowrap rounded-[3px] bg-ink px-1.5 py-0.5 text-[11.5px] font-semibold text-bg num">{countryName} · {fmtScore(score)}</span>
            <span className="h-2 w-px bg-ink" />
          </span>
        </div>
        <div aria-hidden className="relative flex h-28 items-end gap-[3px]">
          {counts.map((c, i) => {
            const b = bandFor(min + w * (i + 0.5), bands);
            return (
              <span key={i} className="hist-bar relative flex-1 rounded-t-[2px] transition-opacity" title={`${fmtScore(min + w * i)}–${fmtScore(min + w * (i + 1))}: ${c} ${c === 1 ? "country" : "countries"}`}
                style={{ height: `${c ? Math.max(5, (c / peak) * 100) : 0}%`, background: b.fill, opacity: i === mine ? 1 : 0.42 }} />
            );
          })}
          <span className="absolute -top-1 bottom-0 w-[2px] bg-ink" style={{ left: `calc(${pct(score)}% - 1px)` }} />
          {median != null && <span className="absolute -top-1 bottom-0 w-0 border-l-[1.5px] border-dashed border-muted" style={{ left: `${pct(median)}%` }} />}
        </div>
        {/* band strip = scale + legend */}
        <div aria-hidden className="mt-1.5 flex h-1.5 gap-px">
          {all.map((b) => <span key={b.label} style={{ flex: b.max - b.min + 1, background: b.fill }} />)}
        </div>
        <div aria-hidden className="relative mt-1.5 h-4 text-[11px] text-muted num">
          <span className="absolute left-0">{min}</span>
          {median != null && <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(median)}%` }}>Median {fmtScore(median)}</span>}
          <span className="absolute right-0">{max}</span>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
        {all.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: b.fill }} />{b.label} <span className="num">{b.min}–{b.max}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-0 border-l-[1.5px] border-dashed border-muted" />Index median</span>
      </figcaption>
    </figure>
  );
}
