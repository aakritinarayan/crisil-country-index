"use server";
import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "./preview";
import { SHARE_COOKIE } from "./admin/hint";

/** Leave preview: this browser sees the published site again; back to the version. */
export async function exitPreview(form: FormData) {
  const id = String(form.get("id") ?? "");
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect(/^[\w-]+$/.test(id) ? `/admin/versions/${id}` : "/admin/versions");
}

/** Leave a shared review: this browser sees the published site again. */
export async function exitSharedPreview() {
  (await draftMode()).disable();
  (await cookies()).delete(SHARE_COOKIE);
  redirect("/");
}
