"use server";
import { updateTag } from "next/cache";
import { INDEX_DATA_TAG } from "@/lib/data";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { capabilitiesFor } from "@/lib/admin/permissions";
import { getVersion, publishVersion } from "@/lib/admin/store";

/** Publish a draft or restore an archived version, after the confirmation step. The
 *  capability is checked here on the server, whatever the page showed. */
export async function publish(_prev: string | null, form: FormData): Promise<string | null> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const found = await getVersion(id);
  if (!found) return "That version doesn’t exist.";
  const need = found.version.status === "archived" ? "restore" : "publish";
  if (!capabilitiesFor(admin).has(need)) return "Your account can’t do this.";
  try {
    await publishVersion(id, admin);
  } catch (e) {
    return e instanceof Error ? e.message : "Publishing failed. Nothing was changed.";
  }
  updateTag(INDEX_DATA_TAG); // every public page re-renders from the newly published version
  redirect(`/admin/versions/${id}?published=1`);
}
