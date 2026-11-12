import "server-only";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import { safeName } from "@/lib/storage";
import { Conflict, type Backend } from "./backend";
import { DIR, SAFE_ID, frameworkFile, payloadFile, readJson, uploadDir, versionsFile, writeJson } from "./files";
import type { AuditEvent, VersionRecord } from "./types";

/* The local store: files under .data/admin (lib/admin/files.ts). One writer at a time within
 * this process stands in for database transactions. */

let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const readVersions = async () => (await readJson<VersionRecord[]>(versionsFile())) ?? [];
async function append(events: AuditEvent[]) {
  if (!events.length) return;
  await mkdir(DIR, { recursive: true });
  await appendFile(path.join(DIR, "events.jsonl"), events.map((e) => JSON.stringify(e) + "\n").join(""), { flag: "a" });
}

export const localBackend: Backend = {
  async load() {
    const versions = await readVersions();
    const events = await readFile(path.join(DIR, "events.jsonl"), "utf8")
      .then((t) => t.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEvent), () => []);
    return { versions, events };
  },
  readPayload: (id) => (SAFE_ID.test(id) ? readJson<Payload>(payloadFile(id)) : Promise.resolve(null)),
  readFramework: (id) => (SAFE_ID.test(id) ? readJson<Framework>(frameworkFile(id)) : Promise.resolve(null)),
  async readPublishedPayload() {
    const live = (await readVersions()).find((v) => v.status === "published");
    return live && SAFE_ID.test(live.id) ? readJson<Payload>(payloadFile(live.id)) : null;
  },
  readSource: (v) => readFile(path.join(uploadDir(v.id, v.validation.passed), safeName(v.source_file.filename))).catch(() => null),

  saveUpload(u) {
    return exclusive(async () => {
      const dir = uploadDir(u.id, !!u.accepted);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, safeName(u.filename)), u.file);                    // 1. the file
      const versions = await readVersions();
      const next = u.accepted ? versions.reduce((m, v) => Math.max(m, v.version ?? 0), 0) + 1 : null;
      if (u.accepted) {
        await writeJson(payloadFile(u.id), u.accepted.payload);                         // 2. its data
        await writeJson(frameworkFile(u.id), u.accepted.framework);
      }
      const { record, events } = u.build(next);
      await writeJson(versionsFile(), [...versions, record]);                           // 3. the version
      await append(events);                                                            // 4. the audit trail
      return record;
    });
  },

  change(plan) {
    return exclusive(async () => {
      const versions = await readVersions();
      const { change, result } = plan(versions);
      const byId = new Map(change.updates.map((u) => [u.id, u]));
      for (const u of change.updates) if (versions.find((v) => v.id === u.id)?.status !== u.expect) throw new Conflict();
      await writeJson(versionsFile(), versions.map((v) => (byId.has(v.id) ? { ...v, ...byId.get(v.id)!.set } : v)));
      await append(change.events);
      return result;
    });
  },
};
