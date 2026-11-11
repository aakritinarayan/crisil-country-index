import { allBands, bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";

/** Segment edges for a band scale: each band runs from its min to the next band's min
 *  (so decimal scores in the gap between whole-number bands sit correctly), the last
 *  band to score_max. Everything comes from the workbook. */
export function bandSegments(bands: ScoreBand[], min: number, max: number) {
  const all = allBands(bands);
  return all.map((b, i) => {
    const from = Math.max(min, b.min);
    const to = Math.min(max, i < all.length - 1 ? all[i + 1].min : max);
    return { ...b, from, to, left: ((from - min) / (max - min)) * 100, width: ((to - from) / (max - min)) * 100 };
  });
}

/** Compact score-band scale: the workbook bands laid out on score_min…score_max with a
 *  marker at the exact score. Numeral and band label are always printed beside it. */
export function BandScale({ score, bands, min, max, subject }: { score: number; bands: ScoreBand[]; min: number; max: number; subject: string }) {
  const segs = bandSegments(bands, min, max);
  const b = bandFor(score, bands);
  const at = Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100));
  return (
    <figure className="max-w-[560px]">
      <figcaption className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-semibold uppercase tracking-[0.12em] text-muted">Position on the scale</span>
        <span className="text-ink-2"><span className="font-semibold text-ink num">{fmtScore(score)}</span> · {b.label}</span>
      </figcaption>
      <div role="img" aria-label={`${subject}: ${fmtScore(score)} on a ${min} to ${max} scale, in the ${b.label} band (${b.min} to ${b.max}).`} className="mt-3">
        <div className="relative h-7">
          {/* marker above the bar */}
          <span className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${at}%` }} aria-hidden>
            <span className="text-[11px] font-bold leading-none text-ink num">{fmtScore(score)}</span>
            <span className="mt-0.5 border-x-[5px] border-t-[6px] border-x-transparent border-t-[var(--ink)]" />
          </span>
        </div>
        <div className="relative h-2.5" aria-hidden>
          {segs.map((s) => (
            <span key={s.label} className="absolute inset-y-0" style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .1), 1px 0 0 var(--bg)" }} />
          ))}
        </div>
        <div className="relative mt-1.5 h-4 text-[11px] text-muted num" aria-hidden>
          {segs.map((s, i) => (
            <span key={s.label} className={`absolute ${i === 0 ? "" : "-translate-x-1/2"}`} style={{ left: `${s.left}%` }}>{s.from}</span>
          ))}
          <span className="absolute right-0">{max}</span>
        </div>
        {/* Band names: shown where there is room, otherwise the printed label above carries it */}
        <div className="relative mt-0.5 hidden h-4 text-[11px] sm:block" aria-hidden>
          {segs.map((s) => (
            <span key={s.label} className={`absolute truncate px-0.5 text-center ${s.label === b.label ? "font-semibold text-ink" : "text-muted"}`} style={{ left: `${s.left}%`, width: `${s.width}%` }}>{s.label}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}
