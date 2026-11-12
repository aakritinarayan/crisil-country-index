import "server-only";
import type { Payload } from "@/lib/types";
import type { Framework } from "@/lib/cfe/types";
import type { AuditEvent, VersionRecord } from "./types";

/* Where versions, their data, their source files and the audit trail are kept. Two
 * implementations: local files (.data/admin — development, and anywhere without a database)
 * and MongoDB + Azure Blob Storage (hosted; TECH_SPEC §6–7). lib/admin/store.ts holds the
 * rules and is the only caller. */

/** An atomic change to version records: each update applies only if the record still has
 *  `expect` status (else the whole change is abandoned), and the events are appended with it. */
export type Change = {
  updates: { id: string; expect: VersionRecord["status"]; set: Partial<VersionRecord> }[];
  events: AuditEvent[];
};

export type NewUpload = {
  id: string;
  filename: string;
  file: Buffer;
  accepted: { payload: Payload; framework: Framework } | null;
  /** Builds the record and its events once the version number (accepted only) is known. */
  build: (version: number | null) => { record: VersionRecord; events: AuditEvent[] };
};

export interface Backend {
  load(): Promise<{ versions: VersionRecord[]; events: AuditEvent[] }>;
  readPayload(id: string): Promise<Payload | null>;
  readFramework(id: string): Promise<Framework | null>;
  readPublishedPayload(): Promise<Payload | null>;
  readSource(v: VersionRecord): Promise<Buffer | null>;
  /** Stores the file first, then the record (with its data), then the events. */
  saveUpload(u: NewUpload): Promise<VersionRecord>;
  /** Reads every version, lets `plan` decide (or throw with a message), applies it atomically. */
  change<T>(plan: (versions: VersionRecord[]) => { change: Change; result: T }): Promise<T>;
}

export class Conflict extends Error {
  constructor() { super("Another administrator changed this version at the same moment. Reload the page and try again."); }
}
