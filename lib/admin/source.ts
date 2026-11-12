import "server-only";
import { mongoConfigured } from "@/lib/mongo";
import { storageConfigured } from "@/lib/storage";
import type { Backend } from "./backend";
import { cloudBackend } from "./backend-cloud";
import { localBackend } from "./backend-local";

/* Which store the admin uses:
 *   demo    ADMIN_DEMO_DATA=true — fictional, read-only records (lib/admin/demo.ts)
 *   cloud   MONGODB_URI and AZURE_STORAGE_CONNECTION_STRING set — the hosted store
 *   local   otherwise — files under .data/admin (development) */
export type Source = "demo" | "local" | "cloud";

export function dataSource(): Source {
  if (process.env.ADMIN_DEMO_DATA === "true") return "demo";
  const m = mongoConfigured(), s = storageConfigured();
  if (m !== s) throw new Error("Set both MONGODB_URI and AZURE_STORAGE_CONNECTION_STRING for the hosted store, or neither for the local one.");
  return m ? "cloud" : "local";
}

export const backend = (): Backend => (dataSource() === "cloud" ? cloudBackend : localBackend);

/** The published version's payload, if one has been published from the admin. Demonstration
 *  records never drive the site. */
export async function readPublishedPayload() {
  return dataSource() === "demo" ? null : backend().readPublishedPayload();
}
