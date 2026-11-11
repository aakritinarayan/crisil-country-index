import Link from "next/link";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { allBands, bandFor, fmtScore, formatAsOf } from "@/lib/bands";
import { ArrowRight } from "@/components/ui/icons";
import { ExplorerProvider } from "@/components/public/explorer/ExplorerContext";
import { ExploreWorkspace } from "@/components/public/explorer/ExploreWorkspace";
import { Rankings } from "@/components/public/explorer/Rankings";
import { NotPublished } from "@/components/public/NotPublished";

/** Split a title so its last two words carry the brand gradient (data-driven, any name). */
function TitleWithAccent({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return <>{text}</>;
  return <>{words.slice(0, -2).join(" ")} <span className="grad-text">{words.slice(-2).join(" ")}</span></>;
}

export default async function Landing() {
  const snapshot = await getPublishedSnapshot();
  if (!snapshot) return <NotPublished />;
  const summary = summarise(snapshot);
  const { meta, countries, pillars } = summary;
  const bands = allBands(meta.score_bands);
  const comps = countries.map((c) => c.composite_score).filter((v): v is number => v != null).sort((a, b) => a - b);
  const median = comps.length ? (comps.length % 2 ? comps[(comps.length - 1) / 2] : (comps[comps.length / 2 - 1] + comps[comps.length / 2]) / 2) : null;
  const dist = bands.map((b) => ({ b, n: comps.filter((v) => bandFor(v, meta.score_bands).index === b.index).length }));

  return (
    <ExplorerProvider summary={summary}>
      {/* Hero */}
      <section className="wrap pb-12 pt-16 text-center sm:pt-24">
        <span className="eyebrow">Data as of {formatAsOf(meta.as_of)}</span>
        <h1 className="t-display mx-auto mt-6 max-w-[16ch] text-ink"><TitleWithAccent text={meta.index_name} /></h1>
        <p className="t-lead mx-auto mt-6 max-w-[62ch] text-muted">{meta.intro}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="#map" className="btn">Explore the map<span className="box"><ArrowRight size={16} /></span></Link>
          <Link href="/methodology" className="btn btn-outline">How scores work<span className="box"><ArrowRight size={16} /></span></Link>
        </div>
      </section>

      {/* At a glance */}
      <section aria-label="At a glance" className="wrap mb-14">
        <dl className="grid grid-cols-2 border border-line bg-raised lg:grid-cols-[1fr_1fr_1fr_2fr]">
          {[
            { k: "Countries assessed", v: String(countries.length) },
            { k: "Pillars", v: String(pillars.length) },
            ...(meta.show_composite && median != null ? [{ k: "Median composite", v: fmtScore(Math.round(median * 10) / 10) }] : []),
          ].map((s) => (
            <div key={s.k} className="border-b border-r border-line p-5 sm:p-6">
              <dt className="text-sm text-muted">{s.k}</dt>
              <dd className="t-stat mt-2 text-ink num">{s.v}</dd>
            </div>
          ))}
          {meta.show_composite && (
            <div className="col-span-2 border-b border-line p-5 sm:p-6 lg:col-span-1">
              <dt className="text-sm text-muted">Countries by composite band</dt>
              <dd className="mt-4">
                <div className="flex h-3 w-full gap-0.5 overflow-hidden" aria-hidden>
                  {dist.filter((d) => d.n > 0).map((d) => <span key={d.b.label} style={{ flex: d.n, background: d.b.fill }} />)}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {dist.map((d) => (
                    <li key={d.b.label} className="flex items-center gap-1.5 text-ink-2">
                      <span className="size-2.5 rounded-full" style={{ background: d.b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .12)" }} aria-hidden />
                      {d.b.label} <span className="font-semibold text-ink num">{d.n}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <ExploreWorkspace />

      <div className="section-pad"><Rankings /></div>

      {/* Methodology prompt */}
      <section className="wrap">
        <div className="grid items-center gap-8 border border-line bg-raised p-8 sm:p-12 md:grid-cols-[2fr_1fr]">
          <div>
            <span className="eyebrow">Methodology</span>
            <h2 className="t-h2 mt-4">How the <span className="grad-text">scores are built</span></h2>
            <p className="mt-4 max-w-[60ch] text-muted">
              {pillars.length} pillars, scored {meta.score_min}–{meta.score_max} and grouped into {bands.length} bands. Read the framework, the scoring approach, the data sources and the assumptions behind the index.
            </p>
          </div>
          <div className="md:justify-self-end">
            <Link href="/methodology" className="btn">Read the methodology<span className="box"><ArrowRight size={16} /></span></Link>
          </div>
        </div>
      </section>
    </ExplorerProvider>
  );
}
