import type { IndexSummary } from "@/lib/types";
import { fmtScore } from "@/lib/bands";
import { ExploreCta, Globe, MethodologyCta } from "./HeroActions";
import { HeroMetrics, type HeroMetricData } from "./HeroMetrics";

/** How many top-scoring countries the globe links with arcs. Decorative density, not data. */
const GLOBE_LINKS = 7;

/** The index's subject, from its published name: "Digital Infrastructure Readiness
 *  Index" → "digital infrastructure readiness". Nothing about the topic is hardcoded. */
function subjectOf(indexName: string) {
  return indexName.replace(/\s+index\s*$/i, "").trim().toLowerCase();
}

/** Immersive dark hero: one headline, one line of context, two CTAs, three live metrics,
 *  and the half-globe. Always dark (both themes), fading into the page below. */
export function Hero({ summary }: { summary: IndexSummary }) {
  const { meta, countries } = summary;
  const subject = subjectOf(meta.index_name);
  const base = subject.replace(/\s+readiness$/, "");

  const withComposite = meta.show_composite ? countries.filter((c) => c.composite_score != null) : [];
  const metrics: HeroMetricData = { count: countries.length, average: null, top: null };
  if (withComposite.length) {
    const mean = withComposite.reduce((t, c) => t + c.composite_score!, 0) / withComposite.length;
    metrics.average = { value: fmtScore(Math.round(mean * 10) / 10), n: withComposite.length };
    const best = Math.max(...withComposite.map((c) => c.composite_score!));
    const leaders = withComposite.filter((c) => c.composite_score === best); // summary order: display_order on ties
    metrics.top = { id: leaders[0].country_id, name: leaders[0].name, score: fmtScore(best), tied: leaders.length - 1 };
  }
  const ranked = [...withComposite].sort((a, b) => b.composite_score! - a.composite_score!);
  const topIso = ranked[0]?.iso_code;

  return (
    <section id="hero" aria-labelledby="hero-h" className="hero relative isolate overflow-hidden">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />

      <div className="hero-content wrap relative z-10 pt-14 text-center sm:pt-20 lg:pt-[72px]">
        <p className="hero-eyebrow">Global country index</p>
        <h1 id="hero-h" className="hero-title mx-auto mt-6 max-w-[920px]">
          Understanding <span className="hero-accent">{subject}</span> across the world.
        </h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[16px] leading-[1.7] text-[var(--h-muted)] sm:text-[18px]">
          Explore how countries perform across key pillars of {base}, backed by transparent assessments and supporting evidence.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ExploreCta />
          <MethodologyCta />
        </div>
      </div>

      {/* Stage: the globe rises from here. Metrics sit on its crest; the hint below them. */}
      <div className="hero-stage relative mt-12 sm:mt-14">
        <div className="globe-wrap absolute left-1/2 top-0 aspect-square w-[clamp(620px,118vw,1640px)]">
          <Globe assessed={countries.map((c) => c.iso_code)} highlight={topIso} links={ranked.slice(0, GLOBE_LINKS).map((c) => c.iso_code)} />
        </div>
        <div className="pointer-events-none relative z-10">
          <div className="wrap pt-[clamp(26px,4.4vw,68px)]">
            <div className="pointer-events-auto mx-auto max-w-[820px] bg-[#0d1415]/45 backdrop-blur-[2px]">
              <HeroMetrics {...metrics} />
            </div>
          </div>
          <div className="flex justify-center pb-[150px] pt-[clamp(110px,15vw,190px)]">
            <p aria-hidden className="globe-hint"><span className="size-1.5 rounded-full bg-[var(--h-orange)]" />Explore the world</p>
          </div>
        </div>
      </div>
      <div aria-hidden className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 z-[5]" />
    </section>
  );
}
