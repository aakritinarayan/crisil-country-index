"use client";
import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { geoArea, geoBounds, geoCentroid, geoDistance, geoOrthographic, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import smallStates from "@/data/small-states.json";
import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";
import { ISO_TO_NUM, SMALL_AREA, loadTopo } from "../geo";
import { EarthCanvas } from "../hero/EarthCanvas";
import { GlobeAtmos } from "./GlobeAtmos";
import { MapControls, WheelHint, tween, useWheelZoom } from "./MapControls";

export type GlobeItem = { id: string; iso: string; name: string; value: number | null };
export type GlobeMode = "intro" | "explore";
/** Where a geographic view is looking, shared when switching between globe and flat map. */
export type GeoFocus = { ll: [number, number]; zoom: number };
export type GeoViewHandle = { getFocus: () => GeoFocus | null; setFocus: (f: GeoFocus) => void };
type Rot = [number, number];

const FILL = 0.47;                 // sphere radius as a share of the shorter side at zoom 1
const HERO_TILT = 35;              // degrees the hero tilts the featured country above centre
const MIN_Z = 1, MAX_Z = 6;
const SMALL = smallStates as unknown as Record<string, [number, number]>;
const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));
const clampLat = (p: number) => Math.max(-80, Math.min(80, p));

/** Centroid of a country's largest polygon, so overseas territories don't pull the
 *  focus point off the mainland (France, Norway, the US). */
function mainCentroid(f: Feature<Geometry>): [number, number] {
  if (f.geometry.type !== "MultiPolygon") return geoCentroid(f) as [number, number];
  const polys = (f.geometry as MultiPolygon).coordinates.map((coordinates): Polygon => ({ type: "Polygon", coordinates }));
  return geoCentroid(polys.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a))) as [number, number];
}
const subscribeTheme = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const facing = ([lon, lat]: [number, number]): Rot => [-lon, -Math.max(-60, Math.min(60, lat))];

/** A shape d3 measures as larger than a hemisphere has its rings wound the wrong way and
 *  would fill the whole sphere; reverse its rings so it draws as itself. */
function upright(f: Feature<Geometry>): Feature<Geometry> {
  if (geoArea(f) <= 2 * Math.PI) return f;
  const flip = (rings: Position[][]) => rings.map((r) => [...r].reverse());
  const g = f.geometry;
  if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: flip(g.coordinates) } };
  if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(flip) } };
  return f;
}

/** Countries, internal borders and coastlines from one topology (Antarctica left out). */
function geography(topo: Topology | null) {
  if (!topo) return null;
  const obj = topo.objects.countries as GeometryCollection;
  const kept = { ...obj, geometries: obj.geometries.filter((g) => g.id !== "010") };
  return {
    features: (feature(topo, kept) as unknown as { features: Feature<Geometry>[] }).features.map(upright),
    borders: mesh(topo, kept, (a, b) => a !== b),
    coast: mesh(topo, kept, (a, b) => a === b),
  };
}

/** The country globe: an orthographic projection drawn as SVG with d3-geo, filling its
 *  container (any shape; the sphere sits in the middle).
 *
 *  Two looks share one set of shapes, blended by the CSS variable `--photo` (0–1) set on
 *  an ancestor: the photographic hero Earth (WebGL texture under faint lines) and the
 *  light explorer globe. The hero → explore hand-off animates `--photo` without re-rendering.
 *
 *  Navigation (explore): drag to rotate; wheel, trackpad pinch, touch pinch and
 *  double-click zoom around the pointer (1×–6×); arrow keys turn it and +/− zoom; the
 *  control group zooms, fits the selected country, resets and expands. Selecting a country
 *  turns it to the front (small states also zoom in) without undoing a closer zoom the
 *  visitor chose. Geometry: 110m while moving, thinned 50m at rest, full 50m above 2×.
 *  Keyboard and screen-reader access to countries is the search and the rankings list. */
export function Globe({ ref, items, bands, neutral, activeBands, selectedId, onSelect, mode, highlight, onActivate, label, photo, controls, expanded = false, onExpand, heroBlend = 1 }: {
  ref?: React.Ref<GeoViewHandle>;
  items: GlobeItem[];
  bands: ScoreBand[];
  neutral: boolean;
  activeBands: Set<number> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: GlobeMode;
  highlight?: string;               // ISO alpha-3 outlined in intro (top performer)
  onActivate: () => void;
  label: string;
  photo: boolean;                   // load the photographic layer at all
  controls?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  /** 0 = the hero's fixed presentation, 1 = the visitor's explorer camera, between = the
   *  scroll hand-off. Only the drawn view blends; the explorer camera itself is untouched. */
  heroBlend?: number;
}) {
  const explore = mode === "explore";
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const R0 = Math.min(w, h) * FILL;

  const [lo, setLo] = useState<Topology | null>(null);
  const [mid, setMid] = useState<Topology | null>(null);
  const [hi, setHi] = useState<Topology | null>(null);
  const [rot, setRot] = useState<Rot | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { loadTopo("110m").then(setLo); }, []);
  useEffect(() => { if (explore && !mid) loadTopo("50m-globe").then(setMid); }, [explore, mid]);
  useEffect(() => { if (explore && zoom > 2 && !hi) loadTopo("50m").then(setHi); }, [explore, zoom, hi]);
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: "drag"; x: number; y: number; rot: Rot; moved: boolean } | { kind: "pinch"; dist: number; zoom: number } | null>(null);
  const moved = useRef(false);
  const stop = useRef<() => void>(() => {});
  const [hover, setHover] = useState<{ item: GlobeItem; x: number; y: number; flip: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);

  const geoLo = useMemo(() => geography(lo), [lo]);
  const geoMid = useMemo(() => geography(mid), [mid]);
  const geoHi = useMemo(() => geography(hi), [hi]);
  const geo = (moving || !explore ? geoLo : (zoom > 2 && geoHi) || geoMid) || geoLo;

  const byNum = useMemo(() => new Map((geoMid ?? geoLo)?.features.map((f) => [String(f.id), f]) ?? []), [geoMid, geoLo]);
  const itemByNum = useMemo(() => new Map(items.map((it) => [ISO_TO_NUM[it.iso], it])), [items]);
  // where each country is, how far it reaches (angular radius), and whether it needs a marker
  const anchor = useMemo(() => new Map(items.flatMap((it) => {
    const f = byNum.get(ISO_TO_NUM[it.iso]);
    const ll = f ? mainCentroid(f) : SMALL[it.iso];
    if (!ll) return [];
    let reach = 0.03;
    if (f) { const [[x0, y0], [x1, y1]] = geoBounds(f); reach = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map((p) => geoDistance(ll, p as [number, number]))); }
    return [[it.id, { ll, small: !f || geoArea(f) < SMALL_AREA, reach: Math.min(Math.max(reach, 0.03), 1.2) }] as const];
  })), [items, byNum]);

  const introRot = useMemo<Rot>(() => {
    const f = highlight ? byNum.get(ISO_TO_NUM[highlight]) : undefined;
    const [lon, lat] = f ? geoCentroid(f) : [20, 20];
    // the focus country ~35° above centre: the middle of the part of the sphere the hero shows
    return [-lon, -(lat - HERO_TILT)];
  }, [byNum, highlight]);
  const current = rot ?? introRot;
  // What is drawn: the hero always shows its fixed composition (introRot, zoom 1); the
  // explorer shows the visitor's camera; the hand-off blends between the two. The
  // visitor's rotation and zoom stay in state, so scrolling away never resets them and
  // explorer zoom can never leak into, or compound with, the hero presentation.
  const blend = Math.max(0, Math.min(1, heroBlend));
  const viewRot: Rot = blend >= 1 ? current : blend <= 0 ? introRot
    : [introRot[0] + ((((current[0] - introRot[0]) % 360) + 540) % 360 - 180) * blend, introRot[1] + (current[1] - introRot[1]) * blend];
  const viewZoom = blend >= 1 ? zoom : Math.exp(Math.log(zoom) * blend);
  const cam = useRef({ rot: current, zoom });
  useEffect(() => { cam.current = { rot: current, zoom }; });

  const projection = useCallback((r: Rot, z: number) =>
    geoOrthographic().scale(R0 * z).translate([w / 2, h / 2]).rotate([r[0], r[1], 0]).clipAngle(90).precision(1), [R0, w, h]);

  /** Move the camera; animated for buttons, fit and selection. */
  const fly = useCallback((to: Rot, z: number, ms = 750) => {
    stop.current();
    const from = cam.current;
    const dl = ((to[0] - from.rot[0] + 540) % 360) - 180; // shortest way round
    const zl0 = Math.log(from.zoom), zl1 = Math.log(clampZ(z));
    setMoving(true);
    stop.current = tween(ms, (e) => {
      setRot([from.rot[0] + dl * e, from.rot[1] + (to[1] - from.rot[1]) * e]);
      setZoom(Math.exp(zl0 + (zl1 - zl0) * e));
    }, () => setMoving(false));
  }, []);
  /** Zoom keeping the geographic point under (x, y) where it is. */
  const zoomAt = useCallback((factor: number, x: number, y: number) => {
    const { rot: r, zoom: z } = cam.current;
    const nz = clampZ(z * factor);
    if (nz === z) return;
    const p = projection(r, z).invert!([x, y]), q = projection(r, nz).invert!([x, y]);
    const inside = p && Math.hypot(x - w / 2, y - h / 2) < R0 * z;
    const next: Rot = inside && q ? [r[0] + (q[0] - p[0]), clampLat(r[1] + (q[1] - p[1]))] : r;
    cam.current = { rot: next, zoom: nz };
    setRot(next); setZoom(nz);
  }, [projection, w, h, R0]);
  const fitZoom = (cid: string) => { const a = anchor.get(cid); return a ? clampZ(0.36 / Math.sin(a.reach)) : 1; };

  // selecting a country turns it to the front; small states also zoom in
  useEffect(() => {
    if (!explore || !selectedId) return;
    const a = anchor.get(selectedId);
    if (!a) return;
    const z = cam.current.zoom;
    const raf = requestAnimationFrame(() => fly(facing(a.ll), a.small ? Math.max(z, Math.min(fitZoom(selectedId), 3)) : z));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new selection only
  }, [explore, selectedId, anchor]);

  useImperativeHandle(ref, () => ({
    getFocus: () => ({ ll: [-cam.current.rot[0], -cam.current.rot[1]], zoom: cam.current.zoom }),
    setFocus: (f) => { stop.current(); setRot(facing(f.ll)); setZoom(clampZ(f.zoom)); },
  }), []);

  const hint = useWheelZoom(box, expanded, (f, x, y) => { if (explore) { stop.current(); zoomAt(f, x, y); } });

  const drawing = useMemo(() => {
    if (!w || !h) return null;
    const proj = projection(viewRot, viewZoom);
    if (viewZoom > 1.2) proj.clipExtent([[-2, -2], [w + 2, h + 2]]); // skip what is off screen
    const path = geoPath(proj).digits(1);
    const centre = proj.invert!([w / 2, h / 2])!;
    const visible = (p: [number, number]) => geoDistance(p, centre) < Math.PI / 2 - 0.03;
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      land: geo?.features.map((f, i) => ({ key: `${f.id ?? "x"}-${i}`, num: String(f.id), d: path(f) ?? "" })).filter((x) => x.d) ?? [],
      borders: geo ? path(geo.borders) ?? "" : "",
      coast: geo ? path(geo.coast) ?? "" : "",
      // small countries get a marker on the visible hemisphere only, until zooming in makes
      // the country itself big enough to click (then the marker would only cover it)
      markers: (() => {
        const all = items.flatMap((it) => {
          const a = anchor.get(it.id);
          if (!a?.small || !visible(a.ll)) return [];
          const f = byNum.get(ISO_TO_NUM[it.iso]);
          if (f && path.area(f) > 260) return [];
          const xy = proj(a.ll);
          return xy ? [{ it, xy }] : [];
        });
        // no overlapping dots: the selection first, then the rest; a dot too close to one
        // already placed waits for a closer zoom (search and the list always reach it)
        all.sort((p, q) => Number(q.it.id === selectedId) - Number(p.it.id === selectedId));
        const placed: typeof all = [];
        for (const m of all) if (placed.every((p) => Math.hypot(p.xy[0] - m.xy[0], p.xy[1] - m.xy[1]) >= 11)) placed.push(m);
        return placed;
      })(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewRot is derived from current/introRot/blend
  }, [geo, items, anchor, byNum, current[0], current[1], introRot, blend, zoom, projection, w, h, selectedId]);

  const fillOf = (it: GlobeItem | undefined) => {
    if (!it) return { fill: neutral ? "var(--globe-land-2)" : `url(#${id("gl-unassessed")})`, dim: false };
    if (neutral || it.value == null) return { fill: "var(--globe-land)", dim: false };
    const b = bandFor(it.value, bands);
    return { fill: b.fill, dim: !!activeBands && !activeBands.has(b.index) };
  };
  const landD = (iso?: string) => (iso ? drawing?.land.find((l) => l.num === ISO_TO_NUM[iso])?.d : undefined);
  const selected = items.find((i) => i.id === selectedId);
  const selD = landD(selected?.iso);
  const hovD = hover && hover.item.id !== selectedId ? landD(hover.item.iso) : undefined;
  const topD = !explore ? landD(highlight) : undefined;

  const tip = (e: React.PointerEvent, item: GlobeItem) => {
    if (!explore || moved.current || e.pointerType !== "mouse") return;
    const r = box.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    setHover({ item, x, y: e.clientY - r.top, flip: x > r.width - 200 });
  };
  const pick = (cid: string) => { if (explore && !moved.current) onSelect(cid); };
  const local = (e: { clientX: number; clientY: number }) => { const r = box.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // pointer gestures: one pointer rotates, two pinch-zoom around their midpoint
  const onDown = (e: React.PointerEvent) => {
    if (!explore) return;
    stop.current();
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    if (pointers.current.size === 1) gesture.current = { kind: "drag", ...local(e), rot: cam.current.rot, moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.current.zoom };
      moved.current = true;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!explore || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((g.zoom * d) / g.dist / cam.current.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (g.kind !== "drag") return;
    const p = local(e);
    const dx = p.x - g.x, dy = p.y - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 4) {
      g.moved = moved.current = true;
      setMoving(true); setGrabbing(true); setHover(null);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (g.moved) {
      const k = 180 / (Math.PI * R0 * cam.current.zoom); // degrees per pixel at the centre
      setRot([g.rot[0] + dx * k, clampLat(g.rot[1] - dy * k)]);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) { gesture.current = null; setMoving(false); setGrabbing(false); setTimeout(() => { moved.current = false; }, 0); }
    else if (pointers.current.size === 1) { const [p] = [...pointers.current.values()]; gesture.current = { kind: "drag", ...p, rot: cam.current.rot, moved: true }; }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!explore || e.target !== e.currentTarget) return;
    const step = 12 / cam.current.zoom, r = cam.current.rot;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => setRot([r[0] + step, r[1]]), ArrowRight: () => setRot([r[0] - step, r[1]]),
      ArrowUp: () => setRot([r[0], clampLat(r[1] - step)]), ArrowDown: () => setRot([r[0], clampLat(r[1] + step)]),
      "+": () => fly(r, cam.current.zoom * 1.5, 300), "=": () => fly(r, cam.current.zoom * 1.5, 300), "-": () => fly(r, cam.current.zoom / 1.5, 300),
      "0": () => fly(introRot, 1),
    };
    if (keys[e.key]) { e.preventDefault(); stop.current(); keys[e.key](); }
  };

  const R = R0 * viewZoom;
  return (
    <div ref={box} data-mode={mode} className={`globe absolute inset-0 select-none ${explore ? (grabbing ? "cursor-grabbing" : "cursor-grab") : ""}`}
      style={{ touchAction: explore ? (expanded ? "none" : "pan-y") : undefined }}
      tabIndex={explore ? 0 : undefined} onKeyDown={onKey}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={explore ? (e) => { const p = local(e); stop.current(); zoomAt(1.8, p.x, p.y); } : undefined}
      aria-label={explore ? "Globe. Drag or use the arrow keys to turn it, plus and minus to zoom." : undefined}>
      {photo && photoOk && w > 0 && <div className="gl-photo absolute inset-0"><EarthCanvas rotate={viewRot} radius={R} onFail={() => setPhotoOk(false)} /></div>}
      {drawing && (
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={`relative block ${viewZoom > 1.02 ? "overflow-hidden" : "overflow-visible"}`}
          role={explore ? "img" : undefined} aria-hidden={explore ? undefined : true}
          aria-label={explore ? `Globe of the ${items.length} assessed countries${neutral ? "" : ", coloured by score band"}. For keyboard and screen-reader access to countries, use the search or the rankings list.` : undefined}>
          <defs>
            {/* unassessed land in score modes: neutral grey with a fine hatch, never a band */}
            <pattern id={id("gl-unassessed")} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" style={{ fill: "var(--unassessed)" }} />
              <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: "var(--unassessed-hatch)" }} strokeWidth="1" />
            </pattern>
            {/* the sea carries the sphere's depth: lit upper left, deeper towards the lower
                right and the limb. In user space, so it stays put at every zoom; nothing is
                laid over the land, so band colours read true. */}
            <radialGradient id={id("gl-ocean")} gradientUnits="userSpaceOnUse" cx={w / 2 - R * 0.32} cy={h / 2 - R * 0.36} r={R * 1.42}>
              <stop offset="0" style={{ stopColor: "var(--globe-ocean)" }} />
              <stop offset=".5" style={{ stopColor: "var(--globe-ocean-mid)" }} />
              <stop offset="1" style={{ stopColor: "var(--globe-ocean-2)" }} />
            </radialGradient>
            {/* soft shading towards the limb, drawn on the sea only (beneath the land) */}
            <radialGradient id={id("gl-limb")} gradientUnits="userSpaceOnUse" cx={w / 2} cy={h / 2} r={R}>
              <stop offset=".72" style={{ stopColor: "var(--globe-limb)" }} stopOpacity="0" />
              <stop offset="1" style={{ stopColor: "var(--globe-limb)" }} />
            </radialGradient>
            <filter id={id("gl-ground")} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={Math.max(6, R * 0.05)} /></filter>
            <radialGradient id={id("gl-atmo-photo")} cx="50%" cy="50%" r="50%">
              <stop offset=".86" stopColor="#00AAA6" stopOpacity="0" />
              <stop offset=".935" stopColor="#00AAA6" stopOpacity=".26" />
              <stop offset=".955" stopColor="#7fe3dc" stopOpacity=".12" />
              <stop offset="1" stopColor="#00AAA6" stopOpacity="0" />
            </radialGradient>
            {/* restrained, diffuse atmosphere: 10% at the limb fading to nothing */}
            <radialGradient id={id("gl-atmo-light")} gradientUnits="userSpaceOnUse" cx={w / 2} cy={h / 2} r={R * 1.05}>
              <stop offset={1 / 1.05 - 0.005} style={{ stopColor: "var(--globe-halo)" }} stopOpacity="0" />
              <stop offset={1 / 1.05} style={{ stopColor: "var(--globe-halo)", stopOpacity: "var(--globe-halo-a)" }} />
              <stop offset="1" style={{ stopColor: "var(--globe-halo)" }} stopOpacity="0" />
            </radialGradient>
            <clipPath id={id("gl-clip")}><circle cx={w / 2} cy={h / 2} r={R} /></clipPath>
          </defs>

          {viewZoom < 1.02 && <>
            <circle cx={w / 2} cy={h / 2} r={R / 0.935} fill={`url(#${id("gl-atmo-photo")})`} className="gl-photo" pointerEvents="none" />
            {/* a soft grounding shadow below right, then the atmosphere */}
            <circle cx={w / 2 + R * 0.03} cy={h / 2 + R * 0.04} r={R * 0.98} fill="var(--globe-shadow)" opacity=".6" filter={`url(#${id("gl-ground")})`} className="gl-light" pointerEvents="none" />
            <circle cx={w / 2} cy={h / 2} r={R * 1.05} fill={`url(#${id("gl-atmo-light")})`} className="gl-light" pointerEvents="none" />
          </>}
          <path d={drawing.sphere} fill={`url(#${id("gl-ocean")})`} className="gl-light" />
          <circle cx={w / 2} cy={h / 2} r={R} fill={`url(#${id("gl-limb")})`} className="gl-light" pointerEvents="none" />
          <g clipPath={`url(#${id("gl-clip")})`}>
            <g className="gl-land">
              {drawing.land.map(({ key, num, d }) => {
                const it = itemByNum.get(num);
                const c = fillOf(it);
                return (
                  <path key={key} d={d} fill={c.fill} opacity={c.dim ? 0.22 : 1}
                    onPointerMove={it ? (e) => tip(e, it) : undefined}
                    onClick={it ? () => pick(it.id) : undefined} />
                );
              })}
            </g>
            <g className="gl-lines" fill="none" pointerEvents="none" strokeLinejoin="round">
              <path d={drawing.borders} stroke="var(--globe-border)" strokeWidth=".65" />
              <path d={drawing.coast} stroke="var(--globe-coast)" strokeWidth=".85" />
            </g>
            {topD && <path d={topD} fill="#95C11F" fillOpacity=".35" stroke="#c8e86a" strokeWidth="1" className="gl-photo" pointerEvents="none" />}
          </g>
          {/* a crisp limb, so the sphere's edge reads against the page */}
          {viewZoom < 1.02 && <circle cx={w / 2} cy={h / 2} r={R} fill="none" stroke="var(--globe-coast)" strokeOpacity=".35" strokeWidth="1" className="gl-light" pointerEvents="none" />}
        </svg>
      )}
      {/* atmosphere between the land and the interactive marks */}
      {explore && w > 0 && (
        <div className="gl-light pointer-events-none absolute inset-0">
          <GlobeAtmos rotate={viewRot} radius={R} dark={dark}
            clouds={(neutral ? 1 : 0.18) * Math.max(0, 1 - (viewZoom - 1) / 3)}
            lights={dark && neutral ? 1 : 0}
            shade={neutral ? 1 : 0.35} />
        </div>
      )}
      {drawing && (
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className="pointer-events-none absolute inset-0 block overflow-hidden">
          <g clipPath={`url(#${id("gl-clip")})`}>
            {/* hover: a soft teal tint in Overview; in score modes the band fill is left alone and only the edge is emphasised */}
            {hovD && <path d={hovD} fill={neutral ? "var(--hover-fill)" : "none"} fillOpacity=".55" stroke="var(--hover-stroke)" strokeWidth="1.2" strokeLinejoin="round" className="gl-hover" pointerEvents="none" />}
            {/* selected: one fill (teal in Overview, the band colour in score modes) and one crisp
                boundary on the same geometry as the base borders, so it covers them exactly */}
            {selD && <>
              <filter id={id("gl-sel-shadow")} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3.5" style={{ floodColor: "var(--sel-shadow)", floodOpacity: "var(--sel-shadow-a)" }} />
              </filter>
              {/* inside the sphere clip, so the shadow never spills past the limb; small states
                  rely on their marker's own small shadow instead of a blurred speck */}
              <path key={selected!.id} d={selD} fill={neutral ? "var(--sel-fill)" : fillOf(selected).fill} stroke="var(--sel-outer)" strokeWidth="2" strokeLinejoin="round" filter={anchor.get(selected!.id)?.small ? undefined : `url(#${id("gl-sel-shadow")})`} className="gl-selected" pointerEvents="none" />
            </>}
            {explore && drawing.markers.map(({ it, xy: [x, y] }) => {
              const on = it.id === selectedId;
              const hot = on || hover?.item.id === it.id;
              const c = fillOf(it);
              return (
                <g key={it.id} className="gl-marker pointer-events-auto cursor-pointer" opacity={c.dim ? 0.25 : 1}
                  onPointerMove={(e) => tip(e, it)} onClick={() => pick(it.id)}>
                  {/* 24px hit area; a 9px deep-teal dot (the band colour in score modes) with a thin white edge */}
                  <circle cx={x} cy={y} r="12" fill="transparent" />
                  {/* one dot, one edge: the band colour (deep teal in Overview); hover grows it, the
                      selection takes the same deep-teal boundary as a selected country */}
                  <circle cx={x} cy={y} r={hot ? 5.4 : 4.5} fill={neutral ? "var(--marker)" : c.fill}
                    stroke={on ? "var(--sel-outer)" : hover?.item.id === it.id ? "var(--hover-stroke)" : neutral ? "var(--marker-edge)" : "var(--marker-score-edge)"}
                    strokeWidth={on ? 1.75 : 1} className={on ? "marker-lift" : undefined} />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {!explore && R0 > 0 && (
        <button type="button" onClick={onActivate} aria-label={label}
          className="globe-btn absolute cursor-pointer rounded-full outline-none"
          style={{ left: w / 2 - R0, top: h / 2 - R0, width: 2 * R0, height: 2 * R0 }} />
      )}

      {explore && hover && (
        <div className="pointer-events-none absolute z-10 border border-line bg-raised/95 px-3 py-2 shadow-soft backdrop-blur-sm"
          style={{ left: hover.x, top: hover.y, transform: `translate(${hover.flip ? "calc(-100% - 14px)" : "14px"}, -50%)` }}>
          <p className="whitespace-nowrap text-[13px] font-semibold text-ink">{hover.item.name}</p>
          {!neutral && (
            <p className="mt-0.5 whitespace-nowrap text-xs text-muted">
              {hover.item.value != null
                ? (() => { const b = bandFor(hover.item.value, bands); return <><span className="font-semibold text-ink num">{fmtScore(hover.item.value)}</span> · {b.label}</>; })()
                : "No score"}
            </p>
          )}
        </div>
      )}

      {explore && <WheelHint show={hint} />}
      {explore && controls && (
        <div className="absolute right-3 top-3 z-20">
          <MapControls
            onZoomIn={() => fly(cam.current.rot, cam.current.zoom * 1.6, 350)} onZoomOut={() => fly(cam.current.rot, cam.current.zoom / 1.6, 350)}
            canZoomIn={zoom < MAX_Z - 0.01} canZoomOut={zoom > MIN_Z + 0.01}
            onFit={() => { const a = selectedId ? anchor.get(selectedId) : undefined; if (a) fly(facing(a.ll), fitZoom(selectedId!)); }} canFit={!!selectedId && anchor.has(selectedId)}
            onReset={() => { fly(introRot, 1); }} canReset={zoom > 1.01 || Math.abs(current[0] - introRot[0]) > 0.5 || Math.abs(current[1] - introRot[1]) > 0.5} resetLabel="Reset rotation and zoom"
            expanded={expanded} onExpand={() => onExpand?.()} />
        </div>
      )}
    </div>
  );
}
