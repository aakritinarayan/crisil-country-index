"use server";
import { updateTag } from "next/cache";
import { INDEX_DATA_TAG } from "@/lib/data";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { capabilitiesFor } from "@/lib/admin/permissions";
import { approveVersion, getVersion, listVersions, publishVersion } from "@/lib/admin/store";
import { isEarlier } from "@/lib/admin/workflow";

/** Publish a Final version (or an earlier one again), after the confirmation step. The
 *  capability is checked here and the workflow rules in the store, whatever the page showed. */
export async function publish(_prev: string | null, form: FormData): Promise<string | null> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const found = await getVersion(id);
  if (!found) return "That version doesn’t exist.";
  const live = (await listVersions()).find((v) => v.status === "published") ?? null;
  const need = isEarlier(found.version, live) || found.version.status === "archived" ? "restore" : "publish";
  if (!capabilitiesFor(admin).has(need)) return "Your account can’t do this.";
  try {
    await publishVersion(id, admin);
  } catch (e) {
    return e instanceof Error ? e.message : "Publishing failed. Nothing was changed.";
  }
  updateTag(INDEX_DATA_TAG); // every public page re-renders from the newly published version
  redirect(`/admin/versions/${id}?published=1`);
}

/** Approve a Final version for publishing (only while approval is required). Approving
 *  doesn't publish: that stays a separate, confirmed step. */
export async function approve(_prev: string | null, form: FormData): Promise<string | null> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!capabilitiesFor(admin).has("approve")) return "Your account can’t do this.";
  try {
    await approveVersion(id, admin);
  } catch (e) {
    return e instanceof Error ? e.message : "Approval failed. Nothing was changed.";
  }
  redirect(`/admin/versions/${id}?approved=1`);
}
