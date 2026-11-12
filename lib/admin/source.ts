import "server-only";
import { mongoConfigured } from "@/lib/mongo";
import { pgConfigured } from "@/lib/pg";
import { storageConfigured } from "@/lib/storage";
import type { Backend } from "./backend";
import { cloudBackend } from "./backend-cloud";
import { localBackend } from "./backend-local";
import { postgresBackend } from "./backend-postgres";

/* Which store the admin uses:
 *   demo    ADMIN_DEMO_DATA=true — only the fictional, read-only records (lib/admin/demo.ts)
 * With ADMIN_DEMO_DATA=merge the demonstration records are shown alongside the real store
 * (local or cloud), which works as normal — a populated prototype that still takes uploads.
 *   cloud   the hosted store: Postgres when DATABASE_URL is set (Neon via Vercel — what is
 *           deployed; files kept in the database), else MongoDB + Azure Blob Storage when
 *           MONGODB_URI and AZURE_STORAGE_CONNECTION_STRING are set (TECH_SPEC §6–7)
 *   local   otherwise — files under .data/admin (development) */
export type Source = "demo" | "local" | "cloud";

/** off: real records only · only: demonstration records only · merge: both. */
export const demoMode = (): "off" | "only" | "merge" =>
  process.env.ADMIN_DEMO_DATA === "true" ? "only" : process.env.ADMIN_DEMO_DATA === "merge" ? "merge" : "off";

export function dataSource(): Source {
  if (demoMode() === "only") return "demo";
  if (pgConfigured()) return "cloud";
  const m = mongoConfigured(), s = storageConfigured();
  if (m !== s) throw new Error("Set both MONGODB_URI and AZURE_STORAGE_CONNECTION_STRING for the hosted store, or neither for the local one.");
  return m ? "cloud" : "local";
}

export const backend = (): Backend => (dataSource() !== "cloud" ? localBackend : pgConfigured() ? postgresBackend : cloudBackend);

/** The published version's payload, if one has been published from the admin. Demonstration
 *  records never drive the site. */
export async function readPublishedPayload() {
  return dataSource() === "demo" ? null : backend().readPublishedPayload();
}
