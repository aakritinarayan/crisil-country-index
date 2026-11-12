import { fmtScore } from "@/lib/bands";
import { ArrowUpRight } from "@/components/ui/icons";
import type { KpiDef, KpiLevel, KpiScore } from "@/lib/types";

/* The evidence behind a pillar score: its KPIs, each with its weight, its score on the KPI
 * scale (1–5) and the level that score names (Low / Moderate / High), the finding and
 * rationale, and its sources. A KPI assessed per procurement route shows every route's
 * score and finding, with the route rationales one step away. A KPI that wasn't assessed
 * says so — it is left out of the pillar score, never counted as zero.
 * Plain markup (no hooks), so the country page and the score drawer can both use it. */

export type KpiView = { def: KpiDef; score: KpiScore | null };

const levelOf = (levels: KpiLevel[], s: number | null) => (s == null ? null : levels.find((l) => l.score === s)?.label ?? null);
const share = (w: number) => `${Math.round(w * 1000) / 10}%`;

export function KpiBreakdown({ kpis, levels, max, compact = false }: { kpis: KpiView[]; levels: KpiLevel[]; max: number; compact?: boolean }) {
  if (!kpis.length) return <p className="text-[14.5px] text-muted">No KPI detail is published for this pillar.</p>;
  return (
    <ol className="kpi-list">
      {kpis.map(({ def, score }, i) => {
        const s = score?.score ?? null;
        // a defined level names a judgement, not an average that happens to land on it
        const label = def.by_route ? null : levelOf(levels, s);
        const showGroup = def.group && def.group !== kpis[i - 1]?.def.group;
        return (
          <li key={def.kpi_id} className="kpi-item">
            {showGroup && <p className="kpi-group">{def.group}</p>}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h5 className="text-[15px] font-semibold leading-snug text-ink">{def.name}</h5>
                <p className="mt-0.5 text-[12.5px] text-muted">{share(def.weight)} of the pillar{def.by_route ? " · assessed for each procurement route" : ""}</p>
              </div>
              <p className="shrink-0 text-right">
                {s == null ? <span className="text-[13px] font-semibold text-muted">Not assessed</span> : (
                  <>
                    <span className="text-[19px] font-semibold leading-none text-ink num">{fmtScore(Math.round(s * 10) / 10)}</span><span className="text-[12.5px] text-muted num"> / {max}</span>
                    <span className="block text-[12px] text-muted">{label ?? (def.by_route ? "route average" : "")}</span>
                  </>
                )}
              </p>
            </div>

            {!compact && def.description && <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{def.description}</p>}

            {score?.routes ? (
              <>
                <table className="route-table mt-3 w-full text-[13.5px]">
                  <caption className="sr-only">{def.name}: score by procurement route</caption>
                  <thead><tr><th scope="col">Route</th><th scope="col" className="w-[64px]">Score</th><th scope="col">Finding</th></tr></thead>
                  <tbody>
                    {score.routes.map((r) => (
                      <tr key={r.route_id}>
                        <th scope="row" className="font-medium text-ink">{r.name}</th>
                        <td className="num">{r.score == null ? <span className="text-muted">—</span> : <span className={`lvl lvl-${r.score}`}>{r.score}</span>}</td>
                        <td className="text-ink-2">{r.finding || <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {score.routes.some((r) => r.rationale) && (
                  <details className="route-why mt-2">
                    <summary>Rationale for each route</summary>
                    <dl className="mt-2 grid gap-3">
                      {score.routes.filter((r) => r.rationale).map((r) => (
                        <div key={r.route_id}><dt className="text-[13px] font-semibold text-ink">{r.name}</dt><dd className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{r.rationale}</dd></div>
                      ))}
                    </dl>
                  </details>
                )}
              </>
            ) : (score?.finding || score?.rationale) ? (
              <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">
                {score.finding && <strong className="font-semibold text-ink">{score.finding}. </strong>}{score.rationale}
              </p>
            ) : null}

            {!compact && s != null && (def.anchors.high || def.anchors.low) && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Scale: {[["5", def.anchors.high], ["3", def.anchors.moderate], ["1", def.anchors.low]].filter(([, t]) => t).map(([n, t]) => `${n} = ${t}`).join(" · ")}</p>
            )}

            {score && score.references.length > 0 && (
              <ul className="mt-2.5 grid gap-1">
                {score.references.map((ref, i) => (
                  <li key={i} className="text-[13px] leading-snug">
                    {ref.url
                      ? <a href={ref.url} target="_blank" rel="noopener noreferrer" className="doc-link">{ref.title || ref.url}<ArrowUpRight size={12} className="ml-0.5 inline-block align-[-1px]" /><span className="sr-only"> (opens in a new tab)</span></a>
                      : <span className="text-ink-2">{ref.title}</span>}
                    {ref.publisher && <span className="text-muted"> · {ref.publisher}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
