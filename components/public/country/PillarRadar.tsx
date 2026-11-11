"use client";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { fmtScore } from "@/lib/bands";

type Row = { pillar: string; score: number; median: number | null };

/** Axis label wrapped onto at most two lines so long workbook pillar names never clip. */
function AxisTick({ x, y, payload, textAnchor }: { x?: number | string; y?: number | string; payload?: { value: string }; textAnchor?: string }) {
  const words = String(payload?.value ?? "").split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 14) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const shown = lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
  const ny = Number(y), dy = ny < 60 ? -(shown.length - 1) * 14 : 0;
  return (
    <text x={x} y={ny + dy} textAnchor={(textAnchor as "start" | "middle" | "end") ?? "middle"} fill="var(--ink-2)" fontSize={12}>
      {shown.map((l, i) => <tspan key={i} x={x} dy={i ? 14 : 4}>{l}</tspan>)}
    </text>
  );
}

/** Pillar profile radar (secondary visual). Animations off: TECH_SPEC §10 allows no
 *  ambient motion. A data table alternative sits beside it for screen readers. */
export function PillarRadar({ rows, min, max, countryName }: { rows: Row[]; min: number; max: number; countryName: string }) {
  const hasMedian = rows.some((r) => r.median != null);
  return (
    <figure>
      <div className="aspect-square w-full max-w-[420px] sm:mx-auto" role="img"
        aria-label={`Radar chart of ${countryName}'s pillar scores${hasMedian ? " against the index median" : ""}. The same values are in the data table below.`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={rows} outerRadius="62%" margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
            <PolarGrid stroke="var(--line-strong)" />
            <PolarAngleAxis dataKey="pillar" tick={(props: object) => <AxisTick {...props} />} />
            <PolarRadiusAxis domain={[min, max]} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickCount={5} angle={90} />
            {hasMedian && <Radar name="Index median" dataKey="median" stroke="var(--muted)" strokeDasharray="4 3" fill="none" isAnimationActive={false} />}
            <Radar name={countryName} dataKey="score" stroke="var(--teal)" strokeWidth={2} fill="var(--brand)" fillOpacity={0.28} isAnimationActive={false}
              dot={{ r: 3, fill: "var(--teal)", strokeWidth: 0 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 border-2 border-[var(--teal)] bg-[var(--brand)]/30" aria-hidden />{countryName}</span>
        {hasMedian && <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-muted" aria-hidden />Index median</span>}
      </figcaption>
      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-link">Show data table</summary>
        <table className="mt-3 w-full text-[13.5px]">
          <caption className="sr-only">{countryName}: pillar scores{hasMedian ? " and index median" : ""}</caption>
          <thead><tr className="border-b border-line-strong text-left text-muted">
            <th scope="col" className="py-1.5 font-semibold">Pillar</th>
            <th scope="col" className="py-1.5 text-right font-semibold">{countryName}</th>
            {hasMedian && <th scope="col" className="py-1.5 text-right font-semibold">Index median</th>}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pillar} className="border-b border-line">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-2">{r.pillar}</th>
                <td className="py-1.5 text-right font-semibold text-ink num">{fmtScore(r.score)}</td>
                {hasMedian && <td className="py-1.5 text-right text-muted num">{r.median != null ? fmtScore(r.median) : "–"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
