import "server-only";
import { MongoClient, type Db } from "mongodb";

/* One MongoDB client per server process (TECH_SPEC §6): serverless invocations reuse the
 * process, so the connection promise is cached on globalThis or connections leak until
 * Atlas refuses new ones. Only the admin store and the published-data read use it. */

export const mongoConfigured = () => !!process.env.MONGODB_URI;

const g = globalThis as { _mongo?: Promise<MongoClient> };

export async function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  g._mongo ??= new MongoClient(uri, { appName: "country-index", serverSelectionTimeoutMS: 10_000 }).connect()
    .catch((e) => { g._mongo = undefined; throw e; }); // a failed connect is retried next time
  return (await g._mongo).db(process.env.MONGODB_DB || "country_index");
}

export async function client(): Promise<MongoClient> {
  await db();
  return g._mongo!;
}
