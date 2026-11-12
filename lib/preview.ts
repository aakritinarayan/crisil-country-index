import "server-only";
import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { auth } from "@/lib/auth";
import { getPublishedSnapshot } from "@/lib/data";
import { dataSource, getVersion, previewPayload } from "@/lib/admin/store";
import type { VersionRecord } from "@/lib/admin/types";
import type { Payload } from "./types";

/* Previewing a version as the public site (FLOW §2: "the full public site rendered from
 * any chosen snapshot"). An administrator opens /admin/preview/[id]: that enables Next's
 * Draft Mode (an unforgeable bypass cookie) plus a cookie naming the version, and the
 * public pages — same URLs, same components — render that version for this browser only.
 * Everyone else keeps getting the static published pages. Preview also requires a live
 * admin session, so an expired session quietly falls back to the published data. */
export { PREVIEW_COOKIE } from "@/lib/admin/hint";
import { PREVIEW_COOKIE, SHARE_COOKIE } from "@/lib/admin/hint";
import { shareCookieValue, sharedVersion } from "./share";

/* Two ways in, same rendering: an administrator previewing a stored version, or a reviewer
 * who opened a share link (lib/share.ts) — that one needs no session, only the cookie the
 * link set, and it stops working as soon as the share token changes. */
export type Preview =
  | { kind: "admin"; version: VersionRecord; demo: boolean; payloadFound: boolean }
  | { kind: "share"; label: string; payload: Payload };

export const previewState = cache(async (): Promise<Preview | null> => {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null; // always the case while pages are prerendered
  const jar = await cookies();
  const id = jar.get(PREVIEW_COOKIE)?.value;
  if (id && (await auth())?.user) {
    const found = await getVersion(id);
    if (found && found.version.status !== "rejected")
      return { kind: "admin", version: found.version, demo: dataSource() === "demo" || found.version.demo === true, payloadFound: (await previewPayload(id)) != null };
  }
  const shared = sharedVersion();
  const expected = shareCookieValue();
  if (shared && expected && jar.get(SHARE_COOKIE)?.value === expected) return { kind: "share", label: shared.label, payload: shared.payload };
  return null;
});

/** The dataset a public page renders: the previewed version for an administrator in
 *  preview, otherwise the published one. (generateStaticParams keeps using
 *  getPublishedSnapshot — there is no request, and so no preview, at build time.) */
export async function getSiteSnapshot(): Promise<Payload | null> {
  const preview = await previewState();
  if (preview?.kind === "share") return preview.payload;
  if (preview) {
    const payload = await previewPayload(preview.version.id);
    if (payload) return payload;
  }
  return getPublishedSnapshot();
}
