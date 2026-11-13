import type { Topology } from "topojson-specification";
import isoTable from "@/data/iso-alpha3-to-numeric.json";

/** Shared world geometry from world-atlas, loaded lazily and once per resolution.
 *  110m:      light, for the hero half-globe and for redrawing while the globe turns.
 *  50m-globe: 50m with its shared arcs thinned to ~0.1° (under a pixel on the globe), so
 *             the explorer globe is crisp at rest but redraws in half the time.
 *  50m:       full detail for the flat map and the country silhouette. */
export const ISO_TO_NUM = isoTable as Record<string, string>;

export type Resolution = "110m" | "50m" | "50m-globe";
const cache: Partial<Record<Resolution, Promise<Topology>>> = {};
const ready: Partial<Record<Resolution, Topology>> = {};
const read = (m: { default?: unknown }) => (m.default ?? m) as unknown as Topology;
export const loadTopo = (res: Resolution = "110m"): Promise<Topology> =>
  (cache[res] ??= (res === "110m" ? import("world-atlas/countries-110m.json").then(read)
    : res === "50m" ? import("world-atlas/countries-50m.json").then(read)
    : loadTopo("50m").then((t) => thin(t, 0.1))).then((t) => (ready[res] = t)));

/** The geometry if it has already loaded, else null — to start a newly mounted map from it
 *  (no loading placeholder when switching country or view once the data is here). */
export const loadedTopo = (res: Resolution): Topology | null => ready[res] ?? null;

/** Drop arc points closer than `tol` degrees to the last kept one. Works on the
 *  topology's shared arcs, so neighbouring countries stay seamless. Short arcs (tiny
 *  islands and atolls) are left whole: thinning them can collapse a ring and flip its
 *  winding, which d3 then draws as "everything except the island" over the whole sphere. */
function thin(topo: Topology, tol: number): Topology {
  const [sx, sy] = topo.transform!.scale;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    const abs = arc.map(([dx, dy]) => [(x += dx), (y += dy)] as const);
    if (abs.length <= 16) return arc;
    const keep = [abs[0]];
    for (let i = 1; i < abs.length - 1; i++) {
      const [px, py] = keep[keep.length - 1];
      if (Math.hypot((abs[i][0] - px) * sx, (abs[i][1] - py) * sy) >= tol) keep.push(abs[i]);
    }
    if (abs.length > 1) keep.push(abs[abs.length - 1]);
    let lx = 0, ly = 0;
    return keep.map(([ax, ay]) => { const d: [number, number] = [ax - lx, ay - ly]; lx = ax; ly = ay; return d; });
  });
  return { ...topo, arcs };
}

/** Countries smaller than this (steradians, ≈ 20,000 km²) also get a marker, so they
 *  stay findable on the globe and the world map: Cyprus, Qatar, Singapore, Bahrain… */
export const SMALL_AREA = 5e-4;
