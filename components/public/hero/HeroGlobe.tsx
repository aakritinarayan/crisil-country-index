"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { ISO_TO_NUM, loadTopo } from "../geo";

const S = 1000, R = 470, C = S / 2;

/** Atmospheric half-globe for the hero. A static orthographic projection drawn as SVG
 *  with d3-geo (no 3D library, no continuous motion). It is centred on the top
 *  performer, picks it out in lime, and links the top-scoring countries with faint
 *  great-circle arcs. Everything shown is derived from the data passed in.
 *
 *  The whole globe is one button: pointer, tap, Enter or Space call `onActivate`.
 *  Hover only raises the boundaries and adds a teal spotlight under the pointer. */
export function HeroGlobe({ assessed, highlight, links, onActivate, label }: {
  assessed: string[];      // ISO alpha-3 of every published country
  highlight?: string;      // ISO alpha-3 shown in lime (top performer)
  links: string[];         // ISO alpha-3, joined by arcs to the first entry
  onActivate: () => void;
  label: string;
}) {
  const [topo, setTopo] = useState<Topology | null>(null);
  useEffect(() => { loadTopo().then(setTopo); }, []);
  const svg = useRef<SVGSVGElement>(null);
  const spot = useRef<SVGCircleElement>(null);

  const features = useMemo(() => {
    if (!topo) return [] as Feature<Geometry>[];
    const fc = feature(topo, topo.objects.countries as GeometryCollection);
    return (fc as unknown as { features: Feature<Geometry>[] }).features.filter((f) => f.id && f.id !== "010");
  }, [topo]);
  const byNum = useMemo(() => new Map(features.map((f) => [String(f.id), f])), [features]);
  const assessedNums = useMemo(() => new Set(assessed.map((iso) => ISO_TO_NUM[iso]).filter(Boolean)), [assessed]);

  const drawing = useMemo(() => {
    const focus = highlight ? byNum.get(ISO_TO_NUM[highlight]) : undefined;
    const [lon, lat] = focus ? geoCentroid(focus) : [20, 20];
    // Tilt so the focus country sits ~50° above centre: on the visible upper cap.
    const proj = geoOrthographic().scale(R).translate([C, C]).rotate([-lon, -(lat - 50), 0]).clipAngle(90).precision(0.6);
    const path = geoPath(proj);
    const centre = proj.invert!([C, C])!;
    const visible = (p: [number, number]) => geoDistance(p, centre) < Math.PI / 2 - 0.02;
    const pts = links.map((iso) => byNum.get(ISO_TO_NUM[iso])).filter((f): f is Feature<Geometry> => !!f).map((f) => geoCentroid(f) as [number, number]);
    const arcs = pts.slice(1).map((p) => path({ type: "LineString", coordinates: [pts[0], p] }) ?? "");
    const nodes = pts.filter(visible).map((p) => proj(p)!);
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(geoGraticule10()) ?? "",
      land: features.map((f) => ({ num: String(f.id), d: path(f) ?? "" })).filter((x) => x.d),
      arcs, nodes,
    };
  }, [features, byNum, highlight, links]);

  const highlightNum = highlight ? ISO_TO_NUM[highlight] : undefined;

  const move = (e: React.PointerEvent) => {
    const el = svg.current, s = spot.current;
    if (!el || !s || e.pointerType !== "mouse") return;
    const m = el.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    s.setAttribute("cx", String(p.x));
    s.setAttribute("cy", String(p.y));
  };

  return (
    <button type="button" onClick={onActivate} onPointerMove={move} aria-label={label}
      className="globe-btn group absolute inset-0 block cursor-pointer outline-none">
      <svg ref={svg} viewBox={`0 0 ${S} ${S}`} className="globe-svg block size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="g-surface" cx="50%" cy="18%" r="75%">
            <stop offset="0" stopColor="#1b2a2b" />
            <stop offset=".55" stopColor="#111a1b" />
            <stop offset="1" stopColor="#0b1112" />
          </radialGradient>
          <radialGradient id="g-atmo" cx="50%" cy="50%" r="50%">
            <stop offset=".86" stopColor="#00AAA6" stopOpacity="0" />
            <stop offset=".935" stopColor="#00AAA6" stopOpacity=".34" />
            <stop offset=".955" stopColor="#7fe3dc" stopOpacity=".22" />
            <stop offset="1" stopColor="#00AAA6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="g-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fe8e1" stopOpacity=".9" />
            <stop offset=".35" stopColor="#00AAA6" stopOpacity=".35" />
            <stop offset=".6" stopColor="#00AAA6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="g-spot">
            <stop offset="0" stopColor="#00AAA6" stopOpacity=".38" />
            <stop offset="1" stopColor="#00AAA6" stopOpacity="0" />
          </radialGradient>
          <clipPath id="g-clip"><circle cx={C} cy={C} r={R} /></clipPath>
        </defs>

        {/* atmosphere: soft teal halo around the horizon */}
        <circle cx={C} cy={C} r={R / 0.935} fill="url(#g-atmo)" />
        <path d={drawing.sphere} fill="url(#g-surface)" />
        <g clipPath="url(#g-clip)">
          <path d={drawing.graticule} fill="none" stroke="#9fc9c5" strokeOpacity=".09" strokeWidth=".8" />
          <g className="g-land">
            {drawing.land.map(({ num, d }) => (
              <path key={num} d={d}
                fill={num === highlightNum ? "#95C11F" : assessedNums.has(num) ? "#24393a" : "#1a2627"}
                fillOpacity={num === highlightNum ? 0.85 : 1}
                stroke="#a9d6d1" strokeWidth=".6" className="g-border" />
            ))}
          </g>
          <circle ref={spot} cx={C} cy={C * 0.6} r="190" fill="url(#g-spot)" className="g-spot" />
          <g fill="none" strokeLinecap="round">
            {drawing.arcs.map((d, i) => <path key={i} d={d} stroke="#95C11F" strokeOpacity=".55" strokeWidth="1.3" />)}
          </g>
          {drawing.nodes.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={i === 0 ? 9 : 6} fill="#00AAA6" fillOpacity=".18" />
              <circle cx={x} cy={y} r={i === 0 ? 3.6 : 2.6} fill={i === 0 ? "#e9f6c8" : "#7fe3dc"} />
            </g>
          ))}
        </g>
        {/* lit rim along the upper horizon */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="url(#g-rim)" strokeWidth="2" />
      </svg>
    </button>
  );
}
