"use client";
import { useEffect, useRef, useState } from "react";
import { compile, load, texture } from "../hero/EarthCanvas";

/** The explorer globe's atmosphere: one WebGL pass over the sphere, drawn between the land
 *  and the interactive marks (hover, selection, markers stay above it, crisp).
 *  - clouds: a faint haze from the cloud texture
 *  - depth: a soft highlight from the upper left and a gently darker limb
 *  - lights (dark theme): warm "city light" glow from the night-lights texture
 *  Amounts are set by the caller: richer in Overview, nearly off when the map is coloured
 *  by score, so band colours stay true. It shares d3's rotation with the SVG, so it moves
 *  exactly with the globe and looks the same idle, dragging or zooming. Pointer events pass
 *  through. If WebGL is unavailable it simply does not draw.
 *  Imagery: Solar System Scope (CC BY 4.0), based on NASA data. */
const CLOUDS = "/globe/earth-clouds-2k.webp";
const NIGHT = "/globe/earth-night-2k.webp";

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D clouds; uniform sampler2D night;
uniform vec2 rot; uniform vec2 res; uniform float radius;
uniform float uClouds; uniform float uLights; uniform float uShade; uniform float uDark;
const float PI = 3.14159265;
void main(){
  vec2 q = v * res * 0.5 / radius;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float vz = sqrt(1.0 - r2);
  float X = vz, Y = q.x, Z = q.y;
  float cp = cos(rot.y), sp = sin(rot.y);
  float lon = atan(Y, X * cp + Z * sp) - rot.x;
  float lat = asin(clamp(Z * cp - X * sp, -1.0, 1.0));
  vec2 uv = vec2(fract((lon + PI) / (2.0 * PI)), (PI / 2.0 - lat) / PI);
  float edge = 1.0 - smoothstep(0.985, 1.0, sqrt(r2));
  // premultiplied colour + alpha, built up layer by layer
  vec3 col = vec3(0.0); float a = 0.0;
  // limb: slightly darker perimeter (deep teal-grey, or near black at night)
  float limb = pow(1.0 - vz, 2.2) * uShade;
  vec3 limbCol = mix(vec3(0.08, 0.22, 0.21), vec3(0.0, 0.02, 0.04), uDark);
  col = limbCol * limb * 0.55; a = limb * 0.55;
  // highlight from the upper left
  float hl = pow(clamp(dot(normalize(vec3(q, vz)), normalize(vec3(-0.55, 0.6, 0.6))), 0.0, 1.0), 6.0) * uShade;
  float hA = hl * mix(0.16, 0.07, uDark);
  col = col * (1.0 - hA) + vec3(1.0) * hA; a = a + hA * (1.0 - a);
  // cloud haze
  float c = smoothstep(0.25, 0.9, texture2D(clouds, uv).r) * uClouds * (0.35 + 0.65 * vz);
  vec3 cCol = mix(vec3(1.0), vec3(0.72, 0.8, 0.84), uDark);
  float cA = c * mix(0.30, 0.16, uDark);
  col = col * (1.0 - cA) + cCol * cA; a = a + cA * (1.0 - a);
  // warm city lights (added light)
  float n = texture2D(night, uv).r;
  float l = pow(n, 1.6) * uLights * (0.25 + 0.75 * vz);
  col += vec3(1.0, 0.76, 0.42) * l * 0.9; a = a + l * 0.6 * (1.0 - a);
  gl_FragColor = vec4(col * edge, clamp(a, 0.0, 1.0) * edge);
}`;

type GL = { ctx: WebGLRenderingContext; u: Record<string, WebGLUniformLocation> };

export function GlobeAtmos({ rotate, radius, clouds, lights, shade, dark }: {
  rotate: [number, number]; radius: number; clouds: number; lights: number; shade: number; dark: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gl = useRef<GL | null>(null);
  const scale = useRef(1);
  const [ready, setReady] = useState(false);
  const latest = useRef({ rotate, radius, clouds, lights, shade, dark });
  useEffect(() => { latest.current = { rotate, radius, clouds, lights, shade, dark }; });

  const draw = () => {
    const g = gl.current, c = canvas.current;
    if (!g || !c) return;
    const { ctx, u } = g, L = latest.current;
    ctx.viewport(0, 0, c.width, c.height);
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.uniform2f(u.rot, (L.rotate[0] * Math.PI) / 180, (L.rotate[1] * Math.PI) / 180);
    ctx.uniform2f(u.res, c.width, c.height);
    ctx.uniform1f(u.radius, L.radius * scale.current);
    ctx.uniform1f(u.uClouds, L.clouds);
    ctx.uniform1f(u.uLights, L.lights);
    ctx.uniform1f(u.uShade, L.shade);
    ctx.uniform1f(u.uDark, L.dark ? 1 : 0);
    ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
  };

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!ctx) return;
    let cancelled = false;
    try {
      const prog = ctx.createProgram()!;
      ctx.attachShader(prog, compile(ctx, ctx.VERTEX_SHADER, VERT));
      ctx.attachShader(prog, compile(ctx, ctx.FRAGMENT_SHADER, FRAG));
      ctx.linkProgram(prog);
      ctx.useProgram(prog);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer());
      ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ctx.STATIC_DRAW);
      const loc = ctx.getAttribLocation(prog, "p");
      ctx.enableVertexAttribArray(loc);
      ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
      ctx.uniform1i(ctx.getUniformLocation(prog, "clouds"), 0);
      ctx.uniform1i(ctx.getUniformLocation(prog, "night"), 1);
      Promise.all([load(CLOUDS), load(NIGHT)]).then(([cl, nt]) => {
        if (cancelled) return;
        texture(ctx, 0, cl);
        texture(ctx, 1, nt);
        const u: GL["u"] = {};
        for (const k of ["rot", "res", "radius", "uClouds", "uLights", "uShade", "uDark"]) u[k] = ctx.getUniformLocation(prog, k)!;
        gl.current = { ctx, u };
        setReady(true);
      }, () => {});
    } catch { /* no atmosphere; the SVG globe stands on its own */ }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const k = Math.min(2048 / Math.max(1, width, height), Math.min(2, window.devicePixelRatio || 1));
      const w = Math.round(width * k), h = Math.round(height * k);
      if (c.width !== w || c.height !== h) { scale.current = k; c.width = w; c.height = h; draw(); }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (ready) draw(); });

  return <canvas ref={canvas} aria-hidden className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />;
}
