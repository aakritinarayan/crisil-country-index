// Prepares a review link (lib/share.ts) for one version in the local admin store.
//   npm run share:link              the published version
//   npm run share:link -- 3         version 3
//   npm run share:link -- 3 --keep  keep the current secret (existing links stay valid)
// Writes the two private values to .data/share/vercel-env.txt (git-ignored) — paste them into
// Vercel → Settings → Environment Variables, then redeploy. Never commit or chat them.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://crisil-country-index.vercel.app";
const dir = path.join(process.cwd(), ".data");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
const wanted = args.find((a) => /^\d+$/.test(a));

const versions = JSON.parse(readFileSync(path.join(dir, "admin", "versions.json"), "utf8"));
const v = wanted ? versions.find((x) => x.version === Number(wanted)) : versions.find((x) => x.status === "published");
if (!v) { console.error(wanted ? `No version ${wanted} in the local store.` : "Nothing is published locally — name a version: npm run share:link -- <number>"); process.exit(1); }
if (!v.validation?.passed) { console.error("That upload failed validation; it can't be shared."); process.exit(1); }
const payload = JSON.parse(readFileSync(path.join(dir, "admin", "payloads", `${v.id}.json`), "utf8"));

const [y, m] = v.as_of.split("-").map(Number);
const period = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const value = gzipSync(JSON.stringify({ label: `Version ${v.version} · ${period}`, payload })).toString("base64");

const out = path.join(dir, "share", "vercel-env.txt");
const previous = existsSync(out) ? readFileSync(out, "utf8").match(/^SHARE_TOKEN=(.+)$/m)?.[1] : null;
const token = keep && previous ? previous : randomBytes(24).toString("base64url");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `SHARE_TOKEN=${token}\nSHARE_PAYLOAD=${value}\n`, { mode: 0o600 });

console.log(`Version ${v.version} (${period}) — ${(value.length / 1024).toFixed(1)} KB encoded${value.length > 48_000 ? "  ⚠ near Vercel's 64 KB environment limit" : ""}`);
console.log(`Values written to ${path.relative(process.cwd(), out)}`);
console.log(`Once they are set on Vercel and redeployed, the link is:\n  ${SITE}/share/${token}`);
if (!keep && previous && previous !== token) console.log("This is a new secret: the previous link stops working once Vercel has it.");
