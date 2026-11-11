import { getPublishedSnapshot, summarise } from "@/lib/data";
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

  return (
    <ExplorerProvider summary={summary}>
      <Hero summary={summary} sample={process.env.SHOW_SAMPLE_DATA_BANNER !== "false"} />


      <ExploreWorkspace />

      <div className="section-pad"><Rankings /></div>

      <ScoreDistribution />

    </ExplorerProvider>
  );
}
