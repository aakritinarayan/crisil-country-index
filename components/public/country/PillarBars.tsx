import { allBands, bandFor, fmtScore } from "@/lib/bands";
import type { Pillar, ScoreBand } from "@/lib/types";

/** Horizontal score bars for every workbook pillar (unscored ones say so) on the workbook's scale. Band edges are drawn faintly behind
 *  each bar; a tick marks the index median for the pillar. Each row links to its
 *  detailed assessment further down the page. */
export function PillarBars({ pillars, scores, medians, bands, min, max, strongest, weakest }: {
  pillars: Pillar[]; scores: Record<string, number>; medians: Record<string, number>;
  bands: ScoreBand[]; min: number; max: number; strongest?: string; weakest?: string;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const all = allBands(bands);
  return (
    <div>
      <ul className="grid">
        {pillars.map((p) => {
          const v = scores[p.pillar_id];
          if (v == null) return (
            <li key={p.pillar_id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line py-4 last:border-0 md:grid-cols-[minmax(160px,220px)_1fr_auto]">
              <span className="text-[15px] font-semibold text-ink-2">{p.name}</span>
              <span className="col-span-2 row-start-2 block h-3.5 border border-dashed border-line-strong md:col-span-1 md:col-start-2 md:row-start-1" aria-hidden />
              <span className="text-right text-[13px] text-muted">Not scored</span>
            </li>
          );
          const b = bandFor(v, bands);
          const med = medians[p.pillar_id];
          const tag = p.pillar_id === strongest ? "Strongest" : p.pillar_id === weakest ? "Weakest" : null;
          return (
            <li key={p.pillar_id} className="border-b border-line last:border-0">
              <a href={`#${p.pillar_id}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[minmax(160px,220px)_1fr_auto]"
                aria-label={`${p.name}: ${fmtScore(v)}, ${b.label}${tag ? `, ${tag.toLowerCase()} pillar` : ""}. Go to the detailed assessment`}>
                <span className="flex items-center gap-2 text-[15px] font-semibold text-ink group-hover:text-link">
                  {p.name}
                  {tag && <span className="border border-line-strong px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wider text-muted">{tag}</span>}
                </span>
                <span className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1" aria-hidden>
                  <span className="relative block h-3.5 bg-sunken">
                    {all.slice(1).map((x) => <span key={x.label} className="absolute inset-y-0 w-px bg-line-strong/70" style={{ left: `${pct(x.min)}%` }} />)}
                    <span className="absolute inset-y-0 left-0" style={{ width: `${pct(v)}%`, background: b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .12)" }} />
                    {med != null && <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `calc(${pct(med)}% - 1px)` }} title={`Index median ${fmtScore(med)}`} />}
                  </span>
                </span>
                <span className="text-right">
                  <span className="text-[19px] font-semibold text-ink num">{fmtScore(v)}</span>{" "}
                  <span className="text-[13px] text-muted">{b.label}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-ink" aria-hidden />Index median</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-line-strong" aria-hidden />Band edges ({all.slice(1).map((x) => x.min).join(", ")})</span>
        <span>Scale {min}–{max}</span>
      </p>
    </div>
  );
}
