import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSiteSnapshot } from "@/lib/preview";
import { showSampleNotice } from "@/lib/data";
import { allBands, formatAsOf } from "@/lib/bands";
import { Prose } from "@/components/public/Prose";
import { NotPublished } from "@/components/public/NotPublished";

/* Methodology. Every word of narrative comes from the published snapshot
 * (meta.methodology.*, meta.intro, meta.disclaimer); pillars, weights, the scale and
 * the readiness bands come from the same configuration the rest of the site uses.
 * Where a field is empty the page says so instead of filling the gap. */

export async function generateMetadata(): Promise<Metadata> {
  const p = await getSiteSnapshot();
  return { title: p ? `Methodology · ${p.meta.index_name}` : "Methodology" };
}

export default async function MethodologyPage() {
  const p = await getSiteSnapshot();
  if (!p) return <NotPublished />;
  const { meta } = p;
  const pillars = [...p.pillars].sort((a, b) => a.display_order - b.display_order);
  const bands = allBands(meta.score_bands);
  const period = formatAsOf(meta.as_of);
  const sample = showSampleNotice(meta);
  const weighted = pillars.filter((x) => x.weight != null);
  // weights published as fractions of 1 read better as percentages; anything else is shown as published
  const asShare = weighted.length > 0 && Math.abs(weighted.reduce((t, x) => t + x.weight!, 0) - 1) < 0.001;
  const span = meta.score_max - meta.score_min;

  return (
    <article className="wrap pb-16">
      <header className="max-w-[1040px] border-b border-line pb-8 pt-10 sm:pt-12">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="transition-colors hover:text-ink">{meta.index_name}</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-ink-2">Methodology</li>
          </ol>
        </nav>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">Methodology</h1>
        <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed text-ink-2">
          Understand how countries are assessed, how scores are assigned and the evidence behind the Country Index.
        </p>
        <p className="mt-4 text-[13.5px] text-muted num">
          Reporting period {period}<span aria-hidden> · </span>{pillars.length} pillars<span aria-hidden> · </span>Scale {meta.score_min}–{meta.score_max}
          {sample && <><span aria-hidden> · </span>Sample data — not a Crisil assessment</>}
        </p>
      </header>

      <div className="max-w-[1040px]">
        <Section id="about" title="About the index">
          {meta.intro && <p className="max-w-[68ch] text-[16px] leading-[1.75] text-ink-2">{meta.intro}</p>}
          <Published text={meta.methodology.framework} what="framework description" className={meta.intro ? "mt-4" : ""} />
        </Section>

        <Section id="pillars" title="Assessment pillars">
          {pillars.length === 0 ? <Missing what="pillar definitions" /> : (
            <ol className="border-t border-line">
              {pillars.map((x, i) => (
                <li key={x.pillar_id} className="grid gap-x-8 gap-y-1 border-b border-line py-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                  <p className="flex gap-3 text-[15.5px] font-semibold text-ink"><span className="w-5 shrink-0 font-normal text-muted num">{i + 1}</span>{x.name}</p>
                  <p className="pl-8 text-[15px] leading-relaxed text-ink-2 sm:pl-0">{x.description || <span className="text-muted">No description published.</span>}</p>
                  {weighted.length > 0 && (
                    <p className="pl-8 text-[14px] text-ink sm:pl-0 sm:text-right num">
                      <span className="text-muted sm:hidden">Weight </span>{x.weight == null ? <span className="text-muted">—</span> : asShare ? `${Math.round(x.weight * 1000) / 10}%` : x.weight}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Section>

        {p.framework && (
          <Section id="kpis" title="Indicators and scoring anchors">
            <p className="max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-2">
              Each pillar is made up of weighted indicators (KPIs), scored from {p.framework.scale.min} to {p.framework.scale.max}
              {p.framework.levels.length > 0 && <> — {[...p.framework.levels].sort((x, y) => x.score - y.score).map((l) => `${l.score} ${l.label}`).join(", ")}</>}.
              {p.framework.kpis.some((k) => k.by_route) && " Indicators marked “per route” are scored for each corporate procurement route and averaged."}
            </p>
            {pillars.map((pl) => {
              const ks = p.framework!.kpis.filter((k) => k.pillar_id === pl.pillar_id);
              if (!ks.length) return null;
              return (
                <div key={pl.pillar_id} className="mt-7">
                  <h3 className="text-[16px] font-semibold text-ink">{pl.name}{pl.weight != null && <span className="font-normal text-muted num"> · {asShare ? `${Math.round(pl.weight * 1000) / 10}%` : pl.weight} of the composite</span>}</h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-[14px]">
                      <caption className="sr-only">{pl.name}: indicators, weights and scoring anchors</caption>
                      <thead><tr className="border-b border-line text-left text-[12.5px] text-muted">
                        <th scope="col" className="py-2 pr-4 font-normal">Indicator</th><th scope="col" className="py-2 pr-4 text-right font-normal">Weight</th>
                        <th scope="col" className="py-2 pr-4 font-normal">5 means</th><th scope="col" className="py-2 pr-4 font-normal">3 means</th><th scope="col" className="py-2 font-normal">1 means</th>
                      </tr></thead>
                      <tbody>
                        {ks.map((k) => (
                          <tr key={k.kpi_id} className="border-b border-line align-top">
                            <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">{k.name}{k.by_route && <span className="mt-0.5 block text-[12px] font-normal text-muted">per route</span>}</th>
                            <td className="py-3 pr-4 text-right text-ink num">{Math.round(k.weight * 1000) / 10}%</td>
                            <td className="py-3 pr-4 text-[13.5px] leading-relaxed text-ink-2">{k.anchors.high || "—"}</td>
                            <td className="py-3 pr-4 text-[13.5px] leading-relaxed text-ink-2">{k.anchors.moderate || "—"}</td>
                            <td className="py-3 text-[13.5px] leading-relaxed text-ink-2">{k.anchors.low || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        <Section id="scoring" title="How scores are calculated">
          <Published text={meta.methodology.scoring} what="scoring approach" />
          <h3 className="mt-8 text-[16px] font-semibold text-ink">Readiness levels</h3>
          <p className="mt-1 text-[14px] text-muted num">Scores run from {meta.score_min} to {meta.score_max} and fall into {bands.length} readiness levels.</p>
          <div className="mt-4">
            <div aria-hidden className="flex h-2.5 gap-[2px] overflow-hidden rounded-[3px]">
              {bands.map((b) => <span key={b.label} style={{ flex: span > 0 ? b.max - b.min + 1 : 1, background: b.fill }} />)}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:gap-[2px]">
              {bands.map((b) => (
                <li key={b.label} className="min-w-0 sm:flex-1" style={{ flexGrow: span > 0 ? b.max - b.min + 1 : 1 }}>
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <span aria-hidden className="band-dot sm:hidden" style={{ "--chip": b.fill } as React.CSSProperties} />{b.label}
                  </span>
                  <span className="block text-[13px] text-muted num">{b.min}–{b.max}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="weighting" title="Weighting and composite score">
          {weighted.length > 0 ? (
            <>
              <p className="max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-2">The published pillar weights{asShare ? ", as shares of the whole," : ""} are:</p>
              <table className="mt-3 w-full max-w-[520px] text-[14.5px]">
                <caption className="sr-only">Pillar weights</caption>
                <thead><tr className="border-b border-line text-left text-[12.5px] text-muted"><th scope="col" className="py-2 font-normal">Pillar</th><th scope="col" className="py-2 text-right font-normal">Weight</th></tr></thead>
                <tbody>
                  {pillars.map((x) => (
                    <tr key={x.pillar_id} className="border-b border-line">
                      <th scope="row" className="py-2.5 text-left font-medium text-ink">{x.name}</th>
                      <td className="py-2.5 text-right text-ink num">{x.weight == null ? <span className="text-muted">Not published</span> : asShare ? `${Math.round(x.weight * 1000) / 10}%` : x.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <p className="max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-2">No pillar weights are published for this edition.</p>}
          <p className="mt-4 max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-2">
            {meta.show_composite
              ? "A composite score is published for each country alongside its pillar scores."
              : "Composite scores are not published for this edition; countries are compared pillar by pillar."}
          </p>
        </Section>

        <Section id="sources" title="Data sources">
          <Published text={meta.methodology.sources} what="data sources description" />
          <p className="mt-4 max-w-[68ch] text-[14.5px] leading-relaxed text-muted">The specific sources behind each score are listed with its rationale on every country profile.</p>
        </Section>

        <Section id="assumptions" title="Assumptions and limitations">
          <Published text={meta.methodology.assumptions} what="assumptions and limitations" />
        </Section>

        <Section id="updates" title="Updates and reporting period">
          <p className="max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-2">
            The data on this site is for the reporting period <strong className="font-semibold text-ink">{period}</strong>. The index is maintained through a monthly assessment workbook; scores change on this site only when a new edition is published.
          </p>
        </Section>

        <Section id="disclaimer" title="Disclaimer">
          <p className="max-w-[68ch] whitespace-pre-line text-[15.5px] leading-[1.75] text-ink-2">{meta.disclaimer || "This index is not a credit rating."}</p>
          {sample && <p className="mt-4 text-[13.5px] font-medium text-ink">Sample data — not a Crisil assessment</p>}
        </Section>
      </div>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-4 gap-x-12 gap-y-4 border-b border-line py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      <h2 id={`${id}-h`} className="text-[20px] font-semibold leading-snug tracking-[-0.015em] text-ink">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Published({ text, what, className = "" }: { text: string; what: string; className?: string }) {
  return text.trim() ? <Prose text={text} skipLeadingHeading className={className} /> : <Missing what={what} />;
}

function Missing({ what }: { what: string }) {
  return <p className="text-[15px] text-muted">Not yet published for this edition: {what}.</p>;
}
