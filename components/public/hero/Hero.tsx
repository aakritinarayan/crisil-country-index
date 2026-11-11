import type { IndexSummary } from "@/lib/types";
import { fmtScore } from "@/lib/bands";
import { ExploreCta, HeroHalfGlobe, MethodologyCta } from "./HeroActions";
import { HeroStars } from "./HeroStars";
import { HeroMetrics, type HeroMetricData } from "./HeroMetrics";

/** The index's subject, from its published name: "Digital Infrastructure Readiness
 *  Index" → "digital infrastructure readiness". Nothing about the topic is hardcoded. */
function subjectOf(indexName: string) {
  return indexName.replace(/\s+index\s*$/i, "").trim().toLowerCase();
}

/** Immersive dark hero: eyebrow, headline, one line of context, two CTAs, three live
 *  metrics, and the half-globe in the lower part. On lg and up that half-globe is the
 *  Country Explorer's globe, drawn up here by ExploreWorkspace and carried down into the
 *  explorer on scroll; below lg the hero shows its own (HeroHalfGlobe).
 *  Always dark (both themes), fading into the light page below. */
export function Hero({ summary, sample = true }: { summary: IndexSummary; sample?: boolean }) {
  const { meta, countries } = summary;
  const subject = subjectOf(meta.index_name);
  const base = subject.replace(/\s+readiness$/, "");
  // highlight the short topic ("digital infrastructure"); the rest of the title stays white
  const rest = subject.slice(base.length);

  const withComposite = meta.show_composite ? countries.filter((c) => c.composite_score != null) : [];
  const metrics: HeroMetricData = { count: countries.length, average: null, top: null };
  if (withComposite.length) {
    const mean = withComposite.reduce((t, c) => t + c.composite_score!, 0) / withComposite.length;
    metrics.average = { value: fmtScore(Math.round(mean * 10) / 10), n: withComposite.length };
    const best = Math.max(...withComposite.map((c) => c.composite_score!));
    const leaders = withComposite.filter((c) => c.composite_score === best); // summary order: display_order on ties
    metrics.top = { id: leaders[0].country_id, name: leaders[0].name, score: fmtScore(best), tied: leaders.length - 1 };
  }
  const topIso = withComposite.find((c) => c.composite_score === Math.max(...withComposite.map((x) => x.composite_score!)))?.iso_code;

  return (
    <>
    {/* one backdrop for the whole hand-off: charcoal at the top blending to the explorer's
        sage as the page scrolls (--bg-mix, set by ExploreWorkspace). No band, no edge. */}
    <div aria-hidden className="tx-backdrop" />
    <section id="hero" aria-labelledby="hero-h" className="hero relative isolate overflow-clip">
      <div id="hero-stage" data-header-tone="dark" className="hero-stage relative">
        <HeroStars />
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div id="hero-intro" className="wrap relative z-10 pt-[clamp(36px,5.5vh,64px)] text-center">
          <p className="hero-eyebrow">Global country index</p>
          {sample && <p className="mx-auto mt-3 w-fit border border-white/15 px-2.5 py-1 text-[12px] font-medium text-[var(--h-ink)] xl:hidden">Sample data — not a Crisil assessment</p>}
          <h1 id="hero-h" className="hero-title mx-auto mt-3 max-w-[1100px]">
            Understanding <span className="hero-accent">{base}</span>{rest} across the world.
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-[16px] leading-[1.65] text-[var(--h-muted)] sm:text-[17px]">
            Explore how countries perform across key pillars of {base}, backed by transparent assessments and supporting evidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ExploreCta />
            <MethodologyCta />
          </div>
          <div className="mx-auto mt-[clamp(28px,4.5vh,44px)] max-w-[760px]">
            <HeroMetrics {...metrics} />
          </div>
        </div>
        <HeroHalfGlobe highlight={topIso} />
        <p className="hero-credit">
          Earth imagery: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--h-ink)]">Solar System Scope</a> (CC BY 4.0), based on NASA data.
        </p>
      </div>
      <div aria-hidden className="hero-spacer" />
    </section>
    </>
  );
}
