import "server-only";
import path from "node:path";
import { cache } from "react";
import type { Admin } from "@/lib/auth";
import { sampleSnapshot } from "@/lib/data";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import { diffFrameworks } from "@/lib/cfe/diff";
import { DEMO_LAST_VERSION, demoData } from "./demo";
import { readJson } from "./files";
import { backend, dataSource, demoMode } from "./source";
import type { Actor, AuditEvent, Validation, VersionRecord } from "./types";
import { approveBlocker, isEarlier, publishBlocker, workflowSettings } from "./workflow";

/* Versions and their audit trail: the rules. Where they are kept is lib/admin/source.ts —
 * MongoDB + Azure Blob Storage when hosted, local files otherwise, or the read-only
 * demonstration records. The console only uses this module.
 *
 * Invariants (DATA_MODEL §3): nothing is ever deleted; exactly one version is published at a
 * time; version numbers only go up and are never reused; the uploaded file is stored before
 * the version that points at it; nothing replaces the live version without passing
 * validation and, when required, approval (lib/admin/workflow.ts). Audit events are
 * append-only: this module offers no way to edit or remove one. */

export { dataSource, demoMode, type Source } from "./source";

/** Read once per request (React cache): a page asks several questions of the same data. */
const load = cache(async (): Promise<{ versions: VersionRecord[]; events: AuditEvent[] }> => {
  const mode = demoMode();
  if (mode === "only") return demoData();
  const real = await backend().load();
  if (mode === "off") return real;
  // merge: the demonstration history first; once a real version is live, the demo's live
  // version reads as replaced (one live version, always)
  const demo = await demoData();
  const realLive = real.versions.some((v) => v.status === "published");
  return {
    versions: [...demo.versions.map((v) => (realLive && v.status === "published" ? { ...v, status: "archived" as const } : v)), ...real.versions],
    events: [...demo.events, ...real.events],
  };
});

export const isDemoRecord = (v: Pick<VersionRecord, "demo">) => v.demo === true;

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
  return dataSource() === "demo" || id.includes("-demo-") ? sampleSnapshot() : backend().readPayload(id);
}

/** The data to pre-fill the next template with: the live version's, else the newest
 *  accepted upload's, else (locally) the converted assessment in .data/cfe, else none —
 *  a blank template. */
export async function latestFramework(): Promise<Framework | null> {
  if (dataSource() !== "demo") {
    const versions = await listVersions();
    const real = versions.filter((v) => !isDemoRecord(v));
    const pick = real.find((v) => v.status === "published") ?? real.find((v) => v.validation.passed);
    const f = pick && (await backend().readFramework(pick.id));
    if (f) return f;
  }
  return readJson<Framework>(path.join(process.cwd(), ".data", "cfe", "framework.json"));
}

/** A version's original upload, exactly as received, if it still exists. */
export function readSourceFile(v: VersionRecord): Promise<Buffer | null> {
  return dataSource() === "demo" || isDemoRecord(v) ? Promise.resolve(null) : backend().readSource(v);
}

/** The actor recorded for an action: built only from the server session (requireAdmin),
 *  never from anything the browser sent. */
export const actorOf = (admin: Admin): Actor => ({ kind: "admin", id: admin.id, name: admin.name, email: admin.email });
const SYSTEM: Actor = { kind: "system", id: "system" };

// ── writes ───────────────────────────────────────────────────────────────────────────
function assertWritable() { if (dataSource() === "demo") throw new Error("Demonstration data is read-only. Set ADMIN_DEMO_DATA=false to work with real uploads."); }

const event = (type: AuditEvent["type"], actor: Actor, version_id: string, data?: AuditEvent["data"], at = new Date().toISOString()): AuditEvent =>
  ({ id: crypto.randomUUID(), type, at, actor, version_id, data });

/** Record an upload: the file is stored first (accepted or rejected, it is kept), then the
 *  version — Final (status "draft") when validation passed, a failed upload (no version
 *  number) when it didn't — then its audit events. Returns the new record. */
export async function recordUpload(input: { admin: Admin; filename: string; file: Buffer; asOf: string; validation: Validation; framework: Framework | null; payload: Payload | null }) {
  assertWritable();
  const { admin, filename, file, asOf, validation, framework, payload } = input;
  const accepted = validation.passed && framework && payload ? { framework, payload } : null;
  const store = backend();

  // compare with what is live now (FLOW §2)
  let changes = null;
  if (accepted) {
    const live = (await store.load()).versions.find((v) => v.status === "published");
    const [liveFramework, livePayload] = live ? await Promise.all([store.readFramework(live.id), store.readPayload(live.id)]) : [null, null];
    if (live && liveFramework && livePayload) changes = diffFrameworks({ framework: liveFramework, payload: livePayload, version: live.version }, accepted);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const actor = actorOf(admin);
  return store.saveUpload({
    id, filename, file, accepted,
    // shown alongside the demonstration history, real versions continue its numbering
    minVersion: demoMode() === "merge" ? DEMO_LAST_VERSION : 0,
    build: (version) => ({
      record: {
        id, version, as_of: asOf, status: accepted ? "draft" : "rejected",
        source_file: { filename, size_bytes: file.length, uploaded_at: now },
        created_at: now, created_by: actor, approved_at: null, approved_by: null, published_at: null, published_by: null,
        validation, changes, counts: payload ? { countries: payload.countries.length, pillars: payload.pillars.length } : null,
      },
      events: [
        event("upload.received", actor, id, { filename, size_bytes: file.length }, now),
        validation.passed ? event("validation.passed", SYSTEM, id, { warnings: validation.warnings.length }) : event("validation.failed", SYSTEM, id, { errors: validation.errors.length }),
        ...(accepted ? [event("draft.created", SYSTEM, id, { version })] : []),
      ],
    }),
  });
}

/** Approve a Final version for publishing — only when approval is required, and never by
 *  the administrator who uploaded it. Recorded separately from publishing. */
export function approveVersion(id: string, admin: Admin) {
  assertWritable();
  const actor = actorOf(admin);
  return backend().change((versions) => {
    const target = versions.find((v) => v.id === id);
    if (!target) throw new Error("That version doesn’t exist.");
    const blocked = approveBlocker(target, actor, workflowSettings());
    if (blocked) throw new Error(`${blocked}.`);
    const now = new Date().toISOString();
    return {
      change: { updates: [{ id, expect: target.status, set: { approved_at: now, approved_by: actor } }], events: [event("version.approved", actor, id, { version: target.version }, now)] },
      result: { version: target.version },
    };
  });
}

/** Publish a Final version: the next update, or an earlier version again (rollback —
 *  FLOW §4, provisional). The rules in lib/admin/workflow.ts are checked inside the same
 *  atomic change, whatever the console showed. The live version becomes archived; exactly
 *  one stays published. */
export async function publishVersion(id: string, admin: Admin) {
  assertWritable();
  const store = backend();
  if (!(await store.readPayload(id))) throw new Error("This version’s data is missing, so it can’t be published.");
  const actor = actorOf(admin);
  return store.change((versions) => {
    const target = versions.find((v) => v.id === id);
    if (!target) throw new Error("That version doesn’t exist.");
    const live = versions.find((v) => v.status === "published") ?? null;
    const blocked = publishBlocker(target, live, workflowSettings());
    if (blocked) throw new Error(`${blocked}. Nothing was changed.`);
    const now = new Date().toISOString();
    const restoring = isEarlier(target, live) || target.status === "archived";
    return {
      change: {
        // the live version steps down first, so there is never a moment with two
        updates: [
          ...(live ? [{ id: live.id, expect: "published" as const, set: { status: "archived" as const } }] : []),
          { id: target.id, expect: target.status, set: { status: "published" as const, published_at: now, published_by: actor } },
        ],
        events: [
          event(restoring ? "version.restored" : "version.published", actor, target.id, { version: target.version, replaced_version: live?.version ?? null }, now),
          ...(live ? [event("version.archived", SYSTEM, live.id, { replaced_by_version: target.version }, now)] : []),
        ],
      },
      result: { version: target.version, restored: restoring },
    };
  });
}
