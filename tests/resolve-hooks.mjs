// Lets node:test import the app's TypeScript modules directly: "@/x" → project root, and
// extensionless relative imports → .ts (the bundler resolves these in the app itself).
// Everything else (packages, their own relative requires) resolves untouched.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const withTs = (file) => ["", ".ts", ".tsx", "/index.ts"].map((e) => file + e).find((f) => path.extname(f) && existsSync(f));

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    const fromApp = context.parentURL?.startsWith(pathToFileURL(root).href) && !context.parentURL.includes("/node_modules/");
    let file = null;
    if (specifier.startsWith("@/")) file = path.join(root, specifier.slice(2));
    else if (fromApp && specifier.startsWith(".") && !path.extname(specifier)) file = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const hit = file && withTs(file);
    return hit ? next(pathToFileURL(hit).href, context) : next(specifier, context);
  },
});
