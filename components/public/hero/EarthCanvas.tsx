"use client";
import { useEffect, useRef, useState } from "react";

/** Photographic Earth surface for the hero globe: one WebGL fragment shader that samples an
 *  equirectangular day texture (plus a cloud layer) for every pixel of the disc, with soft
 *  lighting and a blue rim. No 3D library.
 *
 *  `rotate` is d3-geo's [λ, φ] rotation in degrees, so the photo lines up exactly with the
 *  SVG drawn over it by Globe. The disc is centred and `radius` CSS pixels across, matching
 *  the SVG sphere; the canvas may be any shape.
 *
 *  Imagery: Solar System Scope (CC BY 4.0), based on NASA data — credited in the hero.
 *  If WebGL is unavailable `onFail` is called and HeroGlobe keeps its flat SVG surface. */
const DAY = "/globe/earth-day-2k.webp";
const CLOUDS = "/globe/earth-clouds-2k.webp";

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D day; uniform sampler2D clouds;
uniform vec2 rot;      // d3 rotation (radians): lambda, phi
uniform vec2 res;      // canvas size in backing pixels
uniform float radius;  // disc radius in backing pixels
uniform float aa;      // edge softness in backing pixels
const float PI = 3.14159265;
void main(){
  vec2 q = v * res * 0.5 / radius;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float vz = sqrt(1.0 - r2);
  // view (x right, y up, z to the viewer) -> the frame d3's rotation works in
  float X = vz, Y = q.x, Z = q.y;
  float cp = cos(rot.y), sp = sin(rot.y);
  float lon = atan(Y, X * cp + Z * sp) - rot.x;
  float lat = asin(clamp(Z * cp - X * sp, -1.0, 1.0));
  vec2 uv = vec2(fract((lon + PI) / (2.0 * PI)), (PI / 2.0 - lat) / PI);
  vec3 col = texture2D(day, uv).rgb;
  float cl = texture2D(clouds, uv).r;
  col = mix(col, vec3(0.93, 0.95, 0.97), smoothstep(0.18, 0.85, cl) * 0.75);
  // light from the upper left, a little in front; the far side falls into soft shadow
  vec3 n = vec3(q, vz);
  float diff = clamp(dot(n, normalize(vec3(-0.45, 0.5, 0.75))), 0.0, 1.0);
  col *= 0.22 + 0.9 * diff;
  // atmosphere: restrained teal fresnel rim
  float rim = pow(1.0 - vz, 2.6);
  col = mix(col, vec3(0.30, 0.80, 0.78), rim * 0.42);
  col *= 0.86; // sit below full brightness against the dark hero
  float edge = 1.0 - smoothstep(1.0 - aa / radius, 1.0, sqrt(r2));
  gl_FragColor = vec4(col * edge, edge);
}`;

export function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

export function texture(gl: WebGLRenderingContext, unit: number, img: HTMLImageElement) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  // LINEAR without mipmaps: no seam where longitude wraps
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image();
  i.decoding = "async";
  i.onload = () => res(i);
  i.onerror = rej;
  i.src = src;
});

export function EarthCanvas({ rotate, radius, onFail }: { rotate: [number, number]; radius: number /* CSS px */; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gl = useRef<{ ctx: WebGLRenderingContext; uRot: WebGLUniformLocation; uRad: WebGLUniformLocation; uAa: WebGLUniformLocation; uRes: WebGLUniformLocation } | null>(null);
  const scale = useRef(1); // backing pixels per CSS pixel
  const [ready, setReady] = useState(false);
  const latest = useRef({ rotate, radius });
  useEffect(() => { latest.current = { rotate, radius }; });

  const draw = () => {
    const g = gl.current, c = canvas.current;
    if (!g || !c) return;
    const { ctx } = g, { rotate: [l, p], radius: r } = latest.current;
    ctx.viewport(0, 0, c.width, c.height);
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.uniform2f(g.uRot, (l * Math.PI) / 180, (p * Math.PI) / 180);
    ctx.uniform2f(g.uRes, c.width, c.height);
    ctx.uniform1f(g.uRad, r * scale.current);
    ctx.uniform1f(g.uAa, 1.5);
    ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
  };

  // set up once: context, program, both textures
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!ctx) { onFail(); return; }
    let cancelled = false;
    try {
      const prog = ctx.createProgram()!;
      ctx.attachShader(prog, compile(ctx, ctx.VERTEX_SHADER, VERT));
      ctx.attachShader(prog, compile(ctx, ctx.FRAGMENT_SHADER, FRAG));
      ctx.linkProgram(prog);
      ctx.useProgram(prog);
      const buf = ctx.createBuffer();
      ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
      ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ctx.STATIC_DRAW);
      const loc = ctx.getAttribLocation(prog, "p");
      ctx.enableVertexAttribArray(loc);
      ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
      ctx.uniform1i(ctx.getUniformLocation(prog, "day"), 0);
      ctx.uniform1i(ctx.getUniformLocation(prog, "clouds"), 1);
      Promise.all([load(DAY), load(CLOUDS)]).then(([d, cl]) => {
        if (cancelled) return;
        texture(ctx, 0, d);
        texture(ctx, 1, cl);
        gl.current = { ctx, uRot: ctx.getUniformLocation(prog, "rot")!, uRad: ctx.getUniformLocation(prog, "radius")!, uAa: ctx.getUniformLocation(prog, "aa")!, uRes: ctx.getUniformLocation(prog, "res")! };
        setReady(true);
      }, () => { if (!cancelled) onFail(); });
    } catch { onFail(); }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time GL setup
  }, []);

  // backing store follows the element's size (capped), so the photo stays sharp
  useEffect(() => {
    const c = canvas.current!;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const k = Math.min(2048 / Math.max(1, width, height), Math.min(2, window.devicePixelRatio || 1) * 1.25);
      const w = Math.round(width * k), h = Math.round(height * k);
      if (c.width !== w || c.height !== h) { scale.current = k; c.width = w; c.height = h; draw(); }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (ready) draw(); });

  return <canvas ref={canvas} aria-hidden className={`absolute inset-0 size-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />;
}
