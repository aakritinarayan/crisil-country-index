// Browser check: drives headless Chrome over CDP, runs steps, saves screenshots and
// reports console errors. Usage: node scripts/check/cdp.mjs <steps.json> <outDir>
// steps: [{ "url": "...", "w": 1440, "h": 900, "theme": "dark", "wait": 2500,
//           "eval": "js to run", "shot": "name", "full": true }]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [stepsFile, outDir] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(stepsFile, "utf8"));
mkdirSync(outDir, { recursive: true });
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, "--hide-scrollbars", "--window-size=1440,900",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "cdp-"))}`, "about:blank",
], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    await wait(250);
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
  }
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      errors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 400)}`);
    if (m.method === "Runtime.exceptionThrown") errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable");
  await send("Page.enable");

  let size = [1440, 900];
  for (const s of steps) {
    if (s.w) {
      size = [s.w, s.h ?? 900];
      await send("Emulation.setDeviceMetricsOverride", { width: s.w, height: size[1], deviceScaleFactor: 1, mobile: s.w < 600 });
    }
    if (s.theme) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.theme }] });
    if (s.url) {
      await send("Page.navigate", { url: s.url });
      // wait for load, then for the app to settle
      for (let i = 0; i < 80; i++) {
        const r = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
        if (r.result?.value === "complete") break;
        await wait(250);
      }
    }
    if (s.eval) {
      const r = await send("Runtime.evaluate", { expression: `(async()=>{${s.eval}})()`, awaitPromise: true, returnByValue: true });
      if (r.result?.value !== undefined) console.log(`[${s.shot ?? "eval"}]`, JSON.stringify(r.result.value));
      if (r.exceptionDetails) console.log("eval error:", r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    await wait(s.wait ?? 1500);
    if (s.shot) {
      let clip;
      if (s.full) {
        const m = await send("Page.getLayoutMetrics");
        clip = { x: 0, y: 0, width: size[0], height: Math.min(m.cssContentSize.height, 12000), scale: 1 };
      }
      const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
      writeFileSync(join(outDir, `${s.shot}.png`), Buffer.from(data, "base64"));
    }
  }
  console.log(errors.length ? `console:\n${[...new Set(errors)].join("\n")}` : "console: no errors/warnings");
  ws.close();
} finally {
  chrome.kill();
}
