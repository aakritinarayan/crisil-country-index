"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { IndexSummary } from "@/lib/types";
import { ScoreDrawer } from "./ScoreDrawer";

export type SummaryCountry = IndexSummary["countries"][number];
type DrawerTarget = { countryId: string; pillarId: string; from?: HTMLElement | null };

type Ctx = {
  summary: IndexSummary;
  byId: Map<string, SummaryCountry>;
  openScore: (countryId: string, pillarId: string, from?: HTMLElement | null) => void;
};
const ExplorerCtx = createContext<Ctx | null>(null);
export const useExplorer = () => {
  const c = useContext(ExplorerCtx);
  if (!c) throw new Error("useExplorer outside ExplorerProvider");
  return c;
};

/** Holds the score drawer for every interactive part of the landing page.
 *  The drawer is deep-linkable: ?country=<id>&pillar=<id>. The URL is read on the
 *  client after load (not via useSearchParams) so the page stays fully static. */
export function ExplorerProvider({ summary, children }: { summary: IndexSummary; children: React.ReactNode }) {
  const byId = useMemo(() => new Map(summary.countries.map((c) => [c.country_id, c])), [summary]);
  const [target, setTarget] = useState<DrawerTarget | null>(null);

  const openScore = useCallback((countryId: string, pillarId: string, from?: HTMLElement | null) => {
    setTarget((t) => ({ countryId, pillarId, from: from ?? t?.from ?? null }));
    const url = new URL(window.location.href);
    url.searchParams.set("country", countryId);
    url.searchParams.set("pillar", pillarId);
    window.history.replaceState(null, "", url);
  }, []);

  const close = useCallback(() => {
    setTarget((t) => {
      if (t?.from && document.contains(t.from)) requestAnimationFrame(() => t.from?.focus());
      return null;
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("country");
    url.searchParams.delete("pillar");
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("country"), p = q.get("pillar");
    if (c && p && byId.has(c) && summary.pillars.some((x) => x.pillar_id === p)) setTarget({ countryId: c, pillarId: p });
  }, [byId, summary.pillars]);

  return (
    <ExplorerCtx.Provider value={{ summary, byId, openScore }}>
      {children}
      <ScoreDrawer target={target} onClose={close} onNavigate={(pillarId) => target && openScore(target.countryId, pillarId)} />
    </ExplorerCtx.Provider>
  );
}
