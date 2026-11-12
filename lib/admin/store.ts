import "server-only";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Admin } from "@/lib/auth";
import { getPublishedSnapshot } from "@/lib/data";
import type { Payload } from "@/lib/types";
import { demoData } from "./demo";
import type { Actor, AuditEvent, VersionRecord } from "./types";

/* Version metadata and the audit trail.
 *
 * Local-only for now (no MongoDB / Azure yet): records live under .data/admin/ —
 * versions.json and events.jsonl — and nothing writes versions until upload is connected.
 * With ADMIN_DEMO_DATA=true the console shows the demonstration records instead
 * (lib/admin/demo.ts), and says so. Swapping in Mongo means re-implementing these few
 * functions; the console only uses this module.
 *
 * Audit events are append-only: this module exposes no way to edit or delete one. In
 * production the events collection is insert-only for the app's database user. */

const DIR = path.join(process.cwd(), ".data", "admin");
export type Source = "demo" | "local";
export const dataSource = (): Source => (process.env.ADMIN_DEMO_DATA === "true" ? "demo" : "local");

async function load(): Promise<{ versions: VersionRecord[]; events: AuditEvent[] }> {
  if (dataSource() === "demo") return demoData();
  const versions = await readFile(path.join(DIR, "versions.json"), "utf8").then((t) => JSON.parse(t) as VersionRecord[], () => []);
  const events = await readFile(path.join(DIR, "events.jsonl"), "utf8")
    .then((t) => t.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEvent), () => []);
  return { versions, events };
}

/** Every upload, newest first. */
export async function listVersions(): Promise<VersionRecord[]> {
  const { versions } = await load();
  return [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getVersion(id: string) {
  const { versions, events } = await load();
  const version = versions.find((v) => v.id === id) ?? null;
  return version && { version, events: events.filter((e) => e.version_id === id).sort((a, b) => a.at.localeCompare(b.at)) };
}

/** What the console needs at a glance: the live version and the newest draft that is
 *  newer than it (eligible to publish). */
export async function overview() {
  const versions = await listVersions();
  const live = versions.find((v) => v.status === "published") ?? null;
  const pending = versions.find((v) => v.status === "draft" && v.validation.passed && (live?.version == null || (v.version ?? 0) > live.version)) ?? null;
  return { live, pending, recent: versions.slice(0, 5), total: versions.length };
}

/** The dataset a version would publish. Demonstration records have no stored workbook, so
 *  they preview with the bundled sample (and the preview bar says so); local versions read
 *  the payload saved at upload (.data/admin/payloads/<id>.json). */
export async function previewPayload(id: string): Promise<Payload | null> {
  if (dataSource() === "demo") return getPublishedSnapshot();
  if (!/^[\w-]+$/.test(id)) return null;
  return readFile(path.join(DIR, "payloads", `${id}.json`), "utf8").then((t) => JSON.parse(t) as Payload, () => null);
}

/** The actor recorded for an action: built only from the server session (requireAdmin),
 *  never from anything the browser sent. */
export const actorOf = (admin: Admin): Actor => ({ kind: "admin", id: admin.id, name: admin.name, email: admin.email });

/** Append one audit event. Used by upload / publish / restore once they are connected. */
export async function recordEvent(event: Omit<AuditEvent, "id" | "at">) {
  if (dataSource() === "demo") throw new Error("Demonstration data is read-only.");
  await mkdir(DIR, { recursive: true });
  const full: AuditEvent = { ...event, id: crypto.randomUUID(), at: new Date().toISOString() };
  await appendFile(path.join(DIR, "events.jsonl"), JSON.stringify(full) + "\n", { flag: "a" });
  return full;
}
