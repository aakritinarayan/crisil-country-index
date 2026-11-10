import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";

/** Numeral + band label + band colour, always together (CONTEXT §7). */
export function ScoreChip({ score, bands, size = "md", hideLabel = false }: { score: number; bands: ScoreBand[]; size?: "sm" | "md" | "lg"; hideLabel?: boolean }) {
  const b = bandFor(score, bands);
  const fs = size === "lg" ? "text-xl" : size === "sm" ? "text-[13px]" : "text-[15px]";
  return (
    <span className={`chip ${fs}`} style={{ "--chip-fill": b.fill, "--chip-ink": b.ink } as React.CSSProperties}>
      <span className="n">{fmtScore(score)}</span>
      {hideLabel ? <span className="sr-only">{b.label}</span> : <span className="l">{b.label}</span>}
    </span>
  );
}
