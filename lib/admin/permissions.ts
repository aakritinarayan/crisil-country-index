import "server-only";
import type { Admin } from "@/lib/auth";
import type { Source } from "./store";
import type { VersionRecord } from "./types";

/* Permission readiness. Today every signed-in administrator may do everything.
 * TODO(decision): the client may separate "upload and review" from "publish and restore";
 * when confirmed, derive capabilities from the session (e.g. Entra app roles) here — the
 * console only asks this module, and every server action must check it again. */
export type Capability = "upload" | "preview" | "download" | "publish" | "restore";

export function capabilitiesFor(admin: Admin): Set<Capability> {
  void admin;
  return new Set<Capability>(["upload", "preview", "download", "publish", "restore"]);
}

export type ActionState = { enabled: boolean; reason?: string };
export type VersionActions = { preview: ActionState; download: ActionState; publish: ActionState | null; restore: ActionState | null };

/** Which actions a version offers, and why one is unavailable. Publish is offered on a
 *  draft, restore on an archived version; neither on a rejected upload. */
export function actionsFor(v: VersionRecord, caps: Set<Capability>, source: Source): VersionActions {
  const demo = source === "demo";
  const state = (cap: Capability): ActionState =>
    !caps.has(cap) ? { enabled: false, reason: "Your account can’t do this" }
    : demo && cap !== "preview" ? { enabled: false, reason: "Demonstration record — there is no stored workbook" }
    : { enabled: true };
  const rejected = v.status === "rejected";
  return {
    // preview works for every stored version (demonstration records preview with the sample)
    preview: rejected ? { enabled: false, reason: "A rejected upload can’t be previewed" } : state("preview"),
    download: state("download"),
    publish: v.status === "draft" ? state("publish") : null,
    restore: v.status === "archived" ? state("restore") : null,
  };
}
