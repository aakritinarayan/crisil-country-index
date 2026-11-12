import "server-only";
import { Pool, neon, type PoolClient } from "@neondatabase/serverless";

/* Postgres (Neon, provisioned through Vercel) — the hosted admin store when DATABASE_URL is
 * set. Reads are single HTTP queries (one round trip, no connection to set up); writes use a
 * pool per operation, closed afterwards — Neon's pattern for serverless, where a connection
 * must not outlive the request. The schema is created by the first write. */

export const pgConfigured = () => !!process.env.DATABASE_URL;

/** The schema the admin's tables live in (lets a test run in its own schema). */
export const SCHEMA = (() => {
  const s = process.env.DATABASE_SCHEMA || "country_index";
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error("DATABASE_SCHEMA must be a plain lower-case identifier.");
  return s;
})();

const DDL = `
create schema if not exists ${SCHEMA};
create table if not exists ${SCHEMA}.versions (
  id text primary key, version integer unique, status text not null, record jsonb not null,
  payload jsonb, framework jsonb, created_at timestamptz not null);
create unique index if not exists versions_one_published on ${SCHEMA}.versions ((true)) where status = 'published';
create sequence if not exists ${SCHEMA}.version_seq;
create table if not exists ${SCHEMA}.events (id text primary key, version_id text not null, at timestamptz not null, event jsonb not null);
create index if not exists events_by_version on ${SCHEMA}.events (version_id, at);
create table if not exists ${SCHEMA}.files (path text primary key, content_type text not null, data bytea not null, created_at timestamptz not null default now());
create or replace function ${SCHEMA}.append_only() returns trigger language plpgsql as $$
  begin raise exception '% is append-only', tg_table_name; end $$;
drop trigger if exists events_append_only on ${SCHEMA}.events;
create trigger events_append_only before update or delete on ${SCHEMA}.events for each row execute function ${SCHEMA}.append_only();
drop trigger if exists files_append_only on ${SCHEMA}.files;
create trigger files_append_only before update or delete on ${SCHEMA}.files for each row execute function ${SCHEMA}.append_only();
`;

const g = globalThis as { _ciSchema?: Promise<void> };

/** Runs `fn` with a connection (schema ensured), then closes it. */
export async function withPg<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: url });
  try {
    const c = await pool.connect();
    try {
      // one setup at a time, across every server instance: an advisory lock, held for the
      // transaction (concurrent "create … if not exists" can otherwise collide)
      g._ciSchema ??= c.query(`begin; select pg_advisory_xact_lock(hashtext('${SCHEMA}.ddl')); ${DDL} commit;`)
        .then(() => undefined).catch(async (e) => { g._ciSchema = undefined; await c.query("rollback").catch(() => {}); throw e; });
      await g._ciSchema;
      return await fn(c);
    } finally { c.release(); }
  } finally { await pool.end(); }
}

/** As withPg, inside a transaction that holds the versions table exclusively — changes to
 *  versions happen one at a time (a handful a month; clarity over throughput). */
export function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return withPg(async (c) => {
    await c.query("begin");
    try {
      await c.query(`lock table ${SCHEMA}.versions in exclusive mode`);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    }
  });
}

/** A read: one HTTP query. Before the first write the tables don't exist yet — that reads as
 *  empty, not as an error. */
export async function read<R>(text: string, params: unknown[] = []): Promise<R[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  try {
    return (await neon(url, { fullResults: true }).query(text, params)).rows as R[];
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return []; // undefined table
    throw e;
  }
}
