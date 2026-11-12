import "server-only";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Admin } from "@/lib/auth";
import { sampleSnapshot } from "@/lib/data";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import { diffFrameworks } from "@/lib/cfe/diff";
import { demoData } from "./demo";
import { DIR, SAFE_ID, frameworkFile, payloadFile, readJson, uploadDir, versionsFile, writeJson } from "./files";
import type { Actor, AuditEvent, Validation, VersionRecord } from "./types";
import { approveBlocker, isEarlier, publishBlocker, workflowSettings } from "./workflow";

/* Versions and their audit trail.
 *
 * Local-only for now (no MongoDB / Azure yet): files under .data/admin (lib/admin/files.ts).
 * With ADMIN_DEMO_DATA=true the console shows the demonstration records instead
 * (lib/admin/demo.ts), read-only, and says so. Swapping in Mongo means re-implementing this
 * module; the console only uses it.
 *
 * Invariants (DATA_MODEL §3): nothing is ever deleted; exactly one version is published at a
 * time; version numbers only go up and are never reused; the uploaded file is stored before
 * the version that points at it; nothing replaces the live version without passing
 * validation and, when required, approval (lib/admin/workflow.ts). Audit events are append-only: this module offers no way to
 * edit or remove one. */

export type Source = "demo" | "local";
export const dataSource = (): Source => (process.env.ADMIN_DEMO_DATA === "true" ? "demo" : "local");

async function load(): Promise<{ versions: VersionRecord[]; events: AuditEvent[] }> {
  if (dataSource() === "demo") return demoData();
  const versions = (await readJson<VersionRecord[]>(versionsFile())) ?? [];
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

/** What the console needs at a glance: the live version and the newest Final version that
 *  is newer than it — the next update. */
export async function overview() {
  const versions = await listVersions();
  const live = versions.find((v) => v.status === "published") ?? null;
  const pending = versions.find((v) => v.status === "draft" && v.validation.passed && (live?.version == null || (v.version ?? 0) > live.version)) ?? null;
  return { live, pending, recent: versions.slice(0, 5), total: versions.length };
}

/** What the console needs to explain a version's actions: who is asking, what is live, and
 *  the workflow settings (lib/admin/permissions.ts actionsFor). */
export async function actionContext(admin: Admin, versions?: VersionRecord[]) {
  const all = versions ?? (await listVersions());
  return { actor: actorOf(admin), live: all.find((v) => v.status === "published") ?? null, settings: workflowSettings() };
}

/** The dataset a version would publish. Demonstration records have no stored workbook, so
 *  they preview with the bundled sample (and the preview bar says so). */
export async function previewPayload(id: string): Promise<Payload | null> {
  if (dataSource() === "demo") return sampleSnapshot();
  return SAFE_ID.test(id) ? readJson<Payload>(payloadFile(id)) : null;
}

/** The data to pre-fill the next template with: the live version's, else the newest
 *  accepted upload's, else the converted assessment (.data/cfe/framework.json), else none. */
export async function latestFramework(): Promise<Framework | null> {
  if (dataSource() === "local") {
    const versions = await listVersions();
    const pick = versions.find((v) => v.status === "published") ?? versions.find((v) => v.validation.passed);
    const f = pick && (await readJson<Framework>(frameworkFile(pick.id)));
    if (f) return f;
  }
  return readJson<Framework>(path.join(process.cwd(), ".data", "cfe", "framework.json"));
}

/** Where a version's original upload is kept, if it still exists. */
export function sourceFilePath(v: VersionRecord) {
  return path.join(uploadDir(v.id, v.validation.passed), safeName(v.source_file.filename));
}

/** The actor recorded for an action: built only from the server session (requireAdmin),
 *  never from anything the browser sent. */
export const actorOf = (admin: Admin): Actor => ({ kind: "admin", id: admin.id, name: admin.name, email: admin.email });
const SYSTEM: Actor = { kind: "system", id: "system" };

// ── writes ───────────────────────────────────────────────────────────────────────────
// One writer at a time within this process (a local stand-in for Mongo transactions).
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}
function assertWritable() { if (dataSource() === "demo") throw new Error("Demonstration data is read-only. Set ADMIN_DEMO_DATA=false to work with real uploads."); }

const safeName = (n: string) => (n.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(0, 160) || "workbook.xlsx");
const event = (type: AuditEvent["type"], actor: Actor, version_id: string, data?: AuditEvent["data"], at = new Date().toISOString()): AuditEvent =>
  ({ id: crypto.randomUUID(), type, at, actor, version_id, data });
async function append(events: AuditEvent[]) {
  await mkdir(DIR, { recursive: true });
  await appendFile(path.join(DIR, "events.jsonl"), events.map((e) => JSON.stringify(e) + "\n").join(""), { flag: "a" });
}

/** Record an upload: the file is stored first (accepted or rejected, it is kept), then the
 *  version — Final (status "draft") when validation passed, a rejected upload (no version number) when it
 *  failed — then its audit events. Returns the new record. */
export function recordUpload(input: { admin: Admin; filename: string; file: Buffer; asOf: string; validation: Validation; framework: Framework | null; payload: Payload | null }) {
  assertWritable();
  return exclusive(async () => {
    const { admin, filename, file, asOf, validation, framework, payload } = input;
    const accepted = validation.passed && framework && payload;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dir = uploadDir(id, !!accepted);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName(filename)), file);                    // 1. the file

    const versions = (await readJson<VersionRecord[]>(versionsFile())) ?? [];
    const next = versions.reduce((m, v) => Math.max(m, v.version ?? 0), 0) + 1;
    let changes = null;
    if (accepted) {
      await writeJson(payloadFile(id), payload);                                 // 2. what it renders
      await writeJson(frameworkFile(id), framework);
      const live = versions.find((v) => v.status === "published");
      const liveFramework = live && (await readJson<Framework>(frameworkFile(live.id)));
      const livePayload = live && (await readJson<Payload>(payloadFile(live.id)));
      if (live && liveFramework && livePayload) changes = diffFrameworks({ framework: liveFramework, payload: livePayload, version: live.version }, { framework, payload });
    }
    const actor = actorOf(admin);
    const record: VersionRecord = {
      id, version: accepted ? next : null, as_of: asOf, status: accepted ? "draft" : "rejected",
      source_file: { filename, size_bytes: file.length, uploaded_at: now },
      created_at: now, created_by: actor, approved_at: null, approved_by: null, published_at: null, published_by: null,
      validation, changes, counts: payload ? { countries: payload.countries.length, pillars: payload.pillars.length } : null,
    };
    await writeJson(versionsFile(), [...versions, record]);                       // 3. the version
    await append([                                                               // 4. the audit trail
      event("upload.received", actor, id, { filename, size_bytes: file.length }, now),
      validation.passed ? event("validation.passed", SYSTEM, id, { warnings: validation.warnings.length }) : event("validation.failed", SYSTEM, id, { errors: validation.errors.length }),
      ...(accepted ? [event("draft.created", SYSTEM, id, { version: next })] : []),
    ]);
    return record;
  });
}

/** Approve a Final version for publishing — only when approval is required, and never by
 *  the administrator who uploaded it. Recorded separately from publishing. */
export function approveVersion(id: string, admin: Admin) {
  assertWritable();
  return exclusive(async () => {
    const versions = (await readJson<VersionRecord[]>(versionsFile())) ?? [];
    const target = versions.find((v) => v.id === id);
    if (!target) throw new Error("That version doesn’t exist.");
    const actor = actorOf(admin);
    const blocked = approveBlocker(target, actor, workflowSettings());
    if (blocked) throw new Error(`${blocked}.`);
    const now = new Date().toISOString();
    await writeJson(versionsFile(), versions.map((v) => (v.id === id ? { ...v, approved_at: now, approved_by: actor } : v)));
    await append([event("version.approved", actor, id, { version: target.version }, now)]);
    return { version: target.version };
  });
}

/** Publish a Final version: the next update, or an earlier version again (rollback —
 *  FLOW §4, provisional). The rules in lib/admin/workflow.ts are checked here, whatever the
 *  console showed. The live version becomes archived; exactly one stays published. */
export function publishVersion(id: string, admin: Admin) {
  assertWritable();
  return exclusive(async () => {
    const versions = (await readJson<VersionRecord[]>(versionsFile())) ?? [];
    const target = versions.find((v) => v.id === id);
    if (!target) throw new Error("That version doesn’t exist.");
    const live = versions.find((v) => v.status === "published") ?? null;
    const blocked = publishBlocker(target, live, workflowSettings());
    if (blocked) throw new Error(`${blocked}. Nothing was changed.`);
    if (!(await readJson<Payload>(payloadFile(id)))) throw new Error("This version’s data is missing, so it can’t be published.");

    const now = new Date().toISOString();
    const actor = actorOf(admin);
    const restoring = isEarlier(target, live) || target.status === "archived";
    const updated = versions.map((v) =>
      v.id === target.id ? { ...v, status: "published" as const, published_at: now, published_by: actor }
      : v.id === live?.id ? { ...v, status: "archived" as const } : v);
    await writeJson(versionsFile(), updated);
    await append([
      event(restoring ? "version.restored" : "version.published", actor, target.id, { version: target.version, replaced_version: live?.version ?? null }, now),
      ...(live ? [event("version.archived", SYSTEM, live.id, { replaced_by_version: target.version }, now)] : []),
    ]);
    return { version: target.version, restored: restoring };
  });
}
