"use client";
import { useEffect, useMemo, useState } from "react";
import { geoArea, geoCentroid, geoCircle, geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { ISO_TO_NUM, SMALL_AREA, loadTopo } from "../geo";

const W = 320, H = 320, PAD = 36;

/** The selected country drawn from the same world-atlas 50m geometry as the maps.
 *  Mercator, rotated to the country's own longitude so countries across the date line
 *  (Russia, Fiji) stay whole. The neighbours are ghosted in, faintly, for
 *  edges; the country is drawn in the selection mint with a medium-teal outline, as on
 *  the globe, inside a square tile. Countries too small for the
 *  geometry to describe well (Singapore, Bahrain…) are shown in their region instead,
 *  with a ring marking them, rather than blown up into a crude polygon. Countries missing
 *  from the geometry get no shape and the panel reads fine without it. */
export function CountryShape({ iso, name, fill, variant = "tile" }: { iso: string; name: string; fill: string; variant?: "tile" | "hero" }) {
  const [topo, setTopo] = useState<Topology | null>(null);
  useEffect(() => { loadTopo("50m").then(setTopo); }, []);

  const drawing = useMemo(() => {
    if (!topo) return null;
    const obj = topo.objects.countries as GeometryCollection;
    const kept = { ...obj, geometries: obj.geometries.filter((g) => g.id !== "010") };
    const all = (feature(topo, kept) as unknown as { features: Feature<Geometry>[] }).features;
    const f = all.find((x) => String(x.id) === ISO_TO_NUM[iso]);
    if (!f) return null;
    const centre = geoCentroid(f) as [number, number];
    const small = geoArea(f) < SMALL_AREA;
    const frame = small ? geoCircle().center(centre).radius(5)() : f;
    const proj = geoMercator().rotate([-centre[0], 0]).fitExtent([[PAD, PAD], [W - PAD, H - PAD]], frame);
    const path = geoPath(proj);
    return {
      d: path(f) ?? "",
      ring: small ? proj(centre) : null,
      land: path({ type: "FeatureCollection", features: all.filter((x) => x !== f) }) ?? "",
      borders: path(mesh(topo, kept, (a, b) => a !== b)) ?? "",
    };
  }, [topo, iso]);

  if (!drawing) return <div aria-hidden className="h-4" />;
  if (variant === "hero") {
    // the hero: the country alone, softly lit, on the dark band (neighbours barely there)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="country-glow block size-full overflow-visible" role="img" aria-label={`Map of ${name}`}>
        <defs>
          {/* neighbours only near the country, fading out, never behind the hero text */}
          <radialGradient id={`hero-fade-${iso}`} cx="50%" cy="50%" r="50%">
            <stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`hero-mask-${iso}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect width={W} height={H} fill={`url(#hero-fade-${iso})`} /></mask>
          <filter id={`hero-glow-${iso}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="b" />
            <feFlood floodColor="#5fd3c4" floodOpacity=".35" /><feComposite in2="b" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`hero-fill-${iso}`} x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#9fe3d6" stopOpacity=".55" /><stop offset="1" stopColor="#2f8f84" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <g mask={`url(#hero-mask-${iso})`}>
          <path d={drawing.land} fill="#ffffff" opacity=".05" />
          <path d={drawing.borders} fill="none" stroke="#ffffff" strokeOpacity=".1" strokeWidth=".6" />
        </g>
        <path d={drawing.d} fill={`url(#hero-fill-${iso})`} stroke="#9fe3d6" strokeWidth="1.25" strokeLinejoin="round" filter={`url(#hero-glow-${iso})`} />
        {drawing.ring && <circle cx={drawing.ring[0]} cy={drawing.ring[1]} r="14" fill="none" stroke="#9fe3d6" strokeWidth="1.5" />}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block size-full" role="img" aria-label={`Map of ${name}`}>
      <rect width={W} height={H} fill="var(--tile-bg)" />
      {/* neighbours, barely there, for orientation */}
      <path d={drawing.land} fill="var(--globe-land)" opacity=".55" />
      <path d={drawing.borders} fill="none" stroke="var(--globe-border)" strokeOpacity=".45" strokeWidth=".6" />
      <path d={drawing.d} fill={fill} stroke="var(--sel-outer)" strokeWidth="1.75" strokeLinejoin="round" />
      {drawing.ring && <circle cx={drawing.ring[0]} cy={drawing.ring[1]} r="12" fill="none" stroke="var(--sel-outer)" strokeWidth="1.75" />}
    </svg>
  );
}
