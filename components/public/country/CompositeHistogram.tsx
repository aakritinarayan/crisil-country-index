import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";
import { bandSegments } from "./BandScale";

/** Below this many composite scores a histogram is mostly empty bins and says less
 *  than "rank N of M" does, so the page leaves it out. A display heuristic, not data. */
export const HISTOGRAM_MIN_COUNTRIES = 12;

/** Distribution of composite scores across the index, with the country's bin marked.
 *  Bin count scales with the number of countries; the domain is score_min…score_max. */
export function CompositeHistogram({ values, score, bands, min, max, countryName }: {
  values: number[]; score: number; bands: ScoreBand[]; min: number; max: number; countryName: string;
}) {
  const n = values.length;
  const binCount = Math.min(20, Math.max(6, Math.round(Math.sqrt(n) * 1.5)));
  const w = (max - min) / binCount;
  const binOf = (v: number) => Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / w)));
  const counts = Array.from({ length: binCount }, () => 0);
  values.forEach((v) => counts[binOf(v)]++);
  const peak = Math.max(...counts);
  const mine = binOf(score);
  const below = values.filter((v) => v < score).length;
  const segs = bandSegments(bands, min, max);
  const pctBelow = Math.round((below / n) * 100);

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label text-muted">Where {countryName} sits</span>
        <span className="text-[13px] text-ink-2">Higher than <strong className="font-semibold text-ink num">{pctBelow}%</strong> of {n} countries</span>
      </figcaption>
      <div role="img" className="mt-4"
        aria-label={`Histogram of composite scores for ${n} countries on a ${min} to ${max} scale. ${countryName} scores ${fmtScore(score)}, higher than ${below} of them (${pctBelow}%). The tallest bin holds ${peak} countries.`}>
        <div className="flex h-32 items-end gap-[2px]" aria-hidden>
          {counts.map((c, i) => {
            const mid = min + w * (i + 0.5);
            const b = bandFor(mid, bands);
            const isMine = i === mine;
            return (
              <span key={i} className="relative flex-1" style={{ height: `${Math.max(c ? 6 : 0, (c / peak) * 100)}%` }}>
                <span className="absolute inset-0" style={{ background: b.fill, opacity: isMine ? 1 : 0.55, boxShadow: isMine ? "inset 0 0 0 2px var(--ink)" : "inset 0 0 0 1px rgb(0 0 0 / .08)" }} />
              </span>
            );
          })}
        </div>
        {/* country marker under its exact score */}
        <div className="relative h-8 border-t border-line-strong" aria-hidden>
          <span className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${((score - min) / (max - min)) * 100}%` }}>
            <span className="h-2 w-0.5 bg-ink" />
            <span className="whitespace-nowrap text-[11px] font-bold text-ink num">{fmtScore(score)}</span>
          </span>
        </div>
        <div className="relative h-4 text-[11px] text-muted num" aria-hidden>
          {segs.map((s, i) => <span key={s.label} className={`absolute ${i === 0 ? "" : "-translate-x-1/2"}`} style={{ left: `${s.left}%` }}>{s.from}</span>)}
          <span className="absolute right-0">{max}</span>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">Each bar is a {fmtScore(Math.round(w * 10) / 10)}-point range, coloured by band. The outlined bar holds {countryName}.</p>
    </figure>
  );
}
