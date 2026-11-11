import Link from "next/link";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { allBands } from "@/lib/bands";
import { ArrowRight } from "@/components/ui/icons";
import { ExplorerProvider } from "@/components/public/explorer/ExplorerContext";
import { ExploreWorkspace } from "@/components/public/explorer/ExploreWorkspace";
import { Rankings } from "@/components/public/explorer/Rankings";
import { ScoreDistribution } from "@/components/public/explorer/ScoreDistribution";
import { NotPublished } from "@/components/public/NotPublished";
import { Hero } from "@/components/public/hero/Hero";

export default async function Landing() {
  const snapshot = await getPublishedSnapshot();
  if (!snapshot) return <NotPublished />;
  const summary = summarise(snapshot);
  const { meta, pillars } = summary;
  const bands = allBands(meta.score_bands);

  return (
    <ExplorerProvider summary={summary}>
      <Hero summary={summary} sample={process.env.SHOW_SAMPLE_DATA_BANNER !== "false"} />


      <ExploreWorkspace />

      <div className="section-pad"><Rankings /></div>

      <ScoreDistribution />

      {/* Methodology: a full-bleed atmospheric horizon that runs straight into the footer.
          The cloud deck is the site's own cloud texture laid in perspective (placeholder until
          a licensed cloudscape image is supplied); gradients keep the text readable. */}
      <section aria-labelledby="method-h" className="method-band">
        <div aria-hidden className="method-sky" />
        <div aria-hidden className="method-clouds" />
        <div aria-hidden className="method-shade" />
        <div className="wrap relative grid min-h-[clamp(420px,46vw,620px)] content-end pb-[clamp(3rem,6vw,5rem)] pt-[clamp(8rem,14vw,12rem)]">
          <div className="max-w-[640px]">
            <p className="eyebrow method-eyebrow">How the index works</p>
            <h2 id="method-h" className="t-h2 mt-3 text-white">How the scores are built</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[rgb(232_239_236/0.8)] sm:text-[17px]">
              Explore the scoring framework, assessment pillars, data sources and methodology behind the index.
            </p>
            <p className="mt-4 text-[13.5px] text-[rgb(232_239_236/0.6)] num">
              {pillars.length} assessment pillars · scored {meta.score_min}–{meta.score_max} · {bands.length} readiness bands
            </p>
            <Link href="/methodology" className="hero-btn hero-btn-primary method-cta mt-8">Explore methodology<span className="box" aria-hidden><ArrowRight size={16} /></span></Link>
          </div>
        </div>
      </section>
    </ExplorerProvider>
  );
}
