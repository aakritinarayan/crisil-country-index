import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/* The local store's files (git-ignored .data/admin/), used when no database is configured
 * (lib/admin/backend-local.ts):
 *   versions.json              every version's metadata
 *   events.jsonl               the audit trail, append-only
 *   payloads/<id>.json         what a version renders (calculated at upload)
 *   frameworks/<id>.json       the validated workbook data (seeds the next template)
 *   uploads/<accepted|rejected>/<id>/<filename>   every uploaded file, kept either way */

export const DIR = path.join(process.cwd(), ".data", "admin");
export const SAFE_ID = /^[\w-]+$/;

export const readJson = <T>(file: string): Promise<T | null> => readFile(file, "utf8").then((t) => JSON.parse(t) as T, () => null);

/** Write via a temporary file and rename, so a crash never leaves half a file. */
export async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 1));
  await rename(tmp, file);
}

export const versionsFile = () => path.join(DIR, "versions.json");
export const payloadFile = (id: string) => path.join(DIR, "payloads", `${id}.json`);
export const frameworkFile = (id: string) => path.join(DIR, "frameworks", `${id}.json`);
export const uploadDir = (id: string, accepted: boolean) => path.join(DIR, "uploads", accepted ? "accepted" : "rejected", id);
