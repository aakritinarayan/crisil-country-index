import Link from "next/link";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { allBands } from "@/lib/bands";
import { ArrowRight } from "@/components/ui/icons";
import { ExplorerProvider } from "@/components/public/explorer/ExplorerContext";
import { ExploreWorkspace } from "@/components/public/explorer/ExploreWorkspace";
import { Rankings } from "@/components/public/explorer/Rankings";
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
      <Hero summary={summary} />


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
