import "server-only";
import type { Admin } from "@/lib/auth";
import type { Source } from "./store";
import type { Actor, VersionRecord } from "./types";
import { approveBlocker, awaitingApproval, displayStatus, isEarlier, publishBlocker, type WorkflowSettings } from "./workflow";

/* Permission readiness. Today every signed-in administrator may do everything.
 * TODO(decision): the client may separate "upload and review" from "approve" and "publish";
 * when confirmed, derive capabilities from the session (e.g. Entra app roles) here — the
 * console only asks this module, and every server action must check it again. The workflow
 * rules (approval, rollback) are separate: lib/admin/workflow.ts. */
export type Capability = "upload" | "preview" | "download" | "approve" | "publish" | "restore";

export function capabilitiesFor(admin: Admin): Set<Capability> {
  void admin;
  return new Set<Capability>(["upload", "preview", "download", "approve", "publish", "restore"]);
}

export type ActionState = { enabled: boolean; reason?: string };
export type VersionActions = {
  preview: ActionState;
  download: ActionState;
  approve: ActionState | null;      // only while approval is required and outstanding
  publish: ActionState | null;      // on a Final version; null on the live one or a failed upload
  earlier: boolean;                 // publishing it would roll back to an earlier version
};
export type ActionContext = { actor: Actor; live: VersionRecord | null; settings: WorkflowSettings };

/** Which actions a version offers, and why one is unavailable. */
export function actionsFor(v: VersionRecord, caps: Set<Capability>, source: Source, ctx: ActionContext): VersionActions {
  const demo = source === "demo";
  const state = (cap: Capability, blocker: string | null = null): ActionState =>
    !caps.has(cap) ? { enabled: false, reason: "Your account can’t do this" }
    : demo && cap !== "preview" ? { enabled: false, reason: "Demonstration record — there is no stored workbook" }
    : blocker ? { enabled: false, reason: blocker }
    : { enabled: true };
  const final = displayStatus(v) === "final";
  const earlier = final && isEarlier(v, ctx.live);
  return {
    // preview works for every stored version (demonstration records preview with the sample)
    preview: v.status === "rejected" ? { enabled: false, reason: "An upload that failed validation can’t be previewed" } : state("preview"),
    download: state("download"),
    approve: awaitingApproval(v, ctx.settings) ? state("approve", approveBlocker(v, ctx.actor, ctx.settings)) : null,
    // an earlier version is offered again only while rollback is enabled
    publish: !final || (earlier && !ctx.settings.rollback) ? null : state(earlier ? "restore" : "publish", publishBlocker(v, ctx.live, ctx.settings)),
    earlier,
  };
}
