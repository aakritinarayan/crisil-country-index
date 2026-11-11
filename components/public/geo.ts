import type { Topology } from "topojson-specification";
import isoTable from "@/data/iso-alpha3-to-numeric.json";

/** Shared world geometry: one lazily loaded world-atlas download for the hero globe
 *  and the explorer map. */
export const ISO_TO_NUM = isoTable as Record<string, string>;

let topoPromise: Promise<Topology> | null = null;
export const loadTopo = () =>
  (topoPromise ??= import("world-atlas/countries-110m.json").then((m) => (m.default ?? m) as unknown as Topology));
