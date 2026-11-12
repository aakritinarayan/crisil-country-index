import "server-only";
import type { Collection } from "mongodb";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import { client, db } from "@/lib/mongo";
import { acceptedPath, getBlob, putBlob, rejectedPath } from "@/lib/storage";
import { Conflict, type Backend } from "./backend";
import type { AuditEvent, VersionRecord } from "./types";

/* The hosted store: MongoDB Atlas (system of record) + Azure Blob Storage (source files).
 *   versions   one document per upload: the record, plus `payload` and `framework` for
 *              accepted ones (projected out of every listing)
 *   events     the audit trail — inserted only, never updated or deleted
 *   counters   { _id: "version", seq } — version numbers only go up, never reused
 * A partial unique index allows only one `published` version; publishing runs in a
 * transaction (TECH_SPEC §6), so two simultaneous publishes can't both succeed. */

type VersionDoc = VersionRecord & { _id: string; payload?: Payload; framework?: Framework };
type EventDoc = AuditEvent & { _id: string };
const LIST = { projection: { payload: 0, framework: 0 } } as const;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function cols() {
  const d = await db();
  return { versions: d.collection<VersionDoc>("versions"), events: d.collection<EventDoc>("events"), counters: d.collection<{ _id: string; seq: number }>("counters") };
}

const g = globalThis as { _ciIndexes?: Promise<unknown> };
function ensureIndexes(v: Collection<VersionDoc>, e: Collection<EventDoc>) {
  return (g._ciIndexes ??= Promise.all([
    v.createIndex({ status: 1 }, { name: "one_published", unique: true, partialFilterExpression: { status: "published" } }),
    v.createIndex({ created_at: -1 }),
    e.createIndex({ version_id: 1, at: 1 }),
  ]).catch((err) => { g._ciIndexes = undefined; throw err; }));
}

const strip = <T extends { _id: string }>({ _id, ...rest }: T) => { void _id; return rest; };
const record = (d: VersionDoc): VersionRecord => { const { payload, framework, ...r } = strip(d); void payload; void framework; return r as VersionRecord; };

export const cloudBackend: Backend = {
  async load() {
    const { versions, events } = await cols();
    const [vs, es] = await Promise.all([versions.find({}, LIST).toArray(), events.find({}).toArray()]);
    return { versions: vs.map(record), events: es.map((e) => strip(e) as AuditEvent) };
  },
  async readPayload(id) {
    const d = await (await cols()).versions.findOne({ _id: id }, { projection: { payload: 1 } });
    return d?.payload ?? null;
  },
  async readFramework(id) {
    const d = await (await cols()).versions.findOne({ _id: id }, { projection: { framework: 1 } });
    return d?.framework ?? null;
  },
  async readPublishedPayload() {
    const d = await (await cols()).versions.findOne({ status: "published" }, { projection: { payload: 1 } });
    return d?.payload ?? null;
  },
  readSource: (v) => (v.source_file.blob ? getBlob(v.source_file.blob) : Promise.resolve(null)),

  async saveUpload(u) {
    const { versions, events, counters } = await cols();
    await ensureIndexes(versions, events);
    let version: number | null = null;
    if (u.accepted) {
      if (u.minVersion > 0) await counters.updateOne({ _id: "version" }, { $max: { seq: u.minVersion } }, { upsert: true });
      const c = await counters.findOneAndUpdate({ _id: "version" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
      version = c!.seq;
    }
    const blob = version != null ? acceptedPath(version, u.filename) : rejectedPath(u.id, u.filename);
    await putBlob(blob, u.file, XLSX);                                                 // 1. the file, first
    const built = u.build(version);
    const rec: VersionRecord = { ...built.record, source_file: { ...built.record.source_file, blob } };
    await versions.insertOne({ _id: rec.id, ...rec, ...(u.accepted ?? {}) });          // 2. the version and its data
    if (built.events.length) await events.insertMany(built.events.map((e) => ({ _id: e.id, ...e })));  // 3. the audit trail
    return rec;
  },

  async change(plan) {
    const { versions, events } = await cols();
    await ensureIndexes(versions, events);
    const session = (await client()).startSession();
    try {
      let out: unknown;
      await session.withTransaction(async () => {
        const all = (await versions.find({}, { ...LIST, session }).toArray()).map(record);
        const { change, result } = plan(all);
        for (const u of change.updates) {
          const r = await versions.updateOne({ _id: u.id, status: u.expect }, { $set: u.set }, { session });
          if (r.matchedCount !== 1) throw new Conflict();
        }
        if (change.events.length) await events.insertMany(change.events.map((e) => ({ _id: e.id, ...e })), { session });
        out = result;
      });
      return out as Awaited<ReturnType<typeof plan>>["result"];
    } catch (e) {
      // the one-published index catches a simultaneous publish that slipped past the check
      if ((e as { code?: number }).code === 11000) throw new Conflict();
      throw e;
    } finally {
      await session.endSession();
    }
  },
};
