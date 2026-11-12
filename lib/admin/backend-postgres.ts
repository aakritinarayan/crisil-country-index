import "server-only";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import { SCHEMA, read, withPg, withTransaction } from "@/lib/pg";
import { acceptedPath, rejectedPath } from "@/lib/storage";
import { Conflict, type Backend } from "./backend";
import type { AuditEvent, VersionRecord } from "./types";

/* The hosted store on Postgres (lib/pg.ts):
 *   versions   one row per upload — the record (jsonb), its status, and for accepted ones
 *              the payload and framework; a unique index allows only one 'published'
 *   events     the audit trail — a trigger rejects any update or delete
 *   files      every uploaded workbook, by path (snapshots/v{n}/…, rejected/{id}/…) — also
 *              write-once; written before the version that points at it
 *   version_seq  version numbers: only ever go up, never reused */

const T = { v: `${SCHEMA}.versions`, e: `${SCHEMA}.events`, f: `${SCHEMA}.files` };
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function insertEvents(c: { query: (q: string, p: unknown[]) => Promise<unknown> }, events: AuditEvent[]) {
  for (const e of events) await c.query(`insert into ${T.e} (id, version_id, at, event) values ($1, $2, $3, $4::jsonb)`, [e.id, e.version_id, e.at, JSON.stringify(e)]);
}

export const postgresBackend: Backend = {
  async load() {
    const [v, e] = await Promise.all([
      read<{ record: VersionRecord }>(`select record from ${T.v}`),
      read<{ event: AuditEvent }>(`select event from ${T.e} order by at`),
    ]);
    return { versions: v.map((r) => r.record), events: e.map((r) => r.event) };
  },
  readPayload: async (id) => (await read<{ payload: Payload | null }>(`select payload from ${T.v} where id = $1`, [id]))[0]?.payload ?? null,
  readFramework: async (id) => (await read<{ framework: Framework | null }>(`select framework from ${T.v} where id = $1`, [id]))[0]?.framework ?? null,
  readPublishedPayload: async () => (await read<{ payload: Payload | null }>(`select payload from ${T.v} where status = 'published'`))[0]?.payload ?? null,
  async readSource(v) {
    if (!v.source_file.blob) return null;
    const row = (await read<{ data: string | Buffer }>(`select encode(data, 'base64') as data from ${T.f} where path = $1`, [v.source_file.blob]))[0];
    return row ? Buffer.from(String(row.data), "base64") : null;
  },

  saveUpload: (u) => withPg(async (c) => {
    const version = u.accepted ? Number((await c.query<{ n: string }>(`select nextval('${SCHEMA}.version_seq') as n`)).rows[0].n) : null;
    const path = version != null ? acceptedPath(version, u.filename) : rejectedPath(u.id, u.filename);
    await c.query(`insert into ${T.f} (path, content_type, data) values ($1, $2, $3)`, [path, XLSX, u.file]);   // 1. the file, first
    const built = u.build(version);
    const rec: VersionRecord = { ...built.record, source_file: { ...built.record.source_file, blob: path } };
    await c.query("begin");
    try {
      await c.query(`insert into ${T.v} (id, version, status, record, payload, framework, created_at) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)`,
        [rec.id, rec.version, rec.status, JSON.stringify(rec), u.accepted ? JSON.stringify(u.accepted.payload) : null, u.accepted ? JSON.stringify(u.accepted.framework) : null, rec.created_at]);  // 2. the version
      await insertEvents(c, built.events);                                                                  // 3. the audit trail
      await c.query("commit");
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; }
    return rec;
  }),

  change: (plan) => withTransaction(async (c) => {
    const all = (await c.query<{ record: VersionRecord }>(`select record from ${T.v}`)).rows.map((r) => r.record);
    const { change, result } = plan(all);
    for (const u of change.updates) {
      const next = { ...all.find((v) => v.id === u.id)!, ...u.set };
      const r = await c.query(`update ${T.v} set status = $3, record = $4::jsonb where id = $1 and status = $2`, [u.id, u.expect, next.status, JSON.stringify(next)]);
      if (r.rowCount !== 1) throw new Conflict();
    }
    await insertEvents(c, change.events);
    return result;
  }).catch((e) => { if ((e as { code?: string }).code === "23505") throw new Conflict(); throw e; }),
};
