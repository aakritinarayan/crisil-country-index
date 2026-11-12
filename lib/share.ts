import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Payload } from "./types";

/* Review links: /share/<token> shows one chosen version of the data as the full public site,
 * in preview, to anyone holding the link — no admin account needed. For sharing a version
 * with reviewers before it is published (and before the hosted admin exists).
 *
 * The data never enters the (public) repository: it travels in two private environment
 * variables, made by `npm run share:link`:
 *   SHARE_TOKEN     the secret in the link (32+ characters); change it to revoke the link
 *   SHARE_PAYLOAD   base64(gzip(JSON { label, payload })) — the version to show
 * Nothing is published: everyone without the link keeps the static published pages. */

export type Shared = { label: string; payload: Payload };

const token = () => {
  const t = process.env.SHARE_TOKEN ?? "";
  return t.length >= 32 ? t : null;   // a short token would be guessable: treat as off
};
const digest = (s: string) => createHash("sha256").update(s).digest();

/** The cookie value for a browser that opened the current link. */
export const shareCookieValue = () => { const t = token(); return t ? digest(`cookie:${t}`).toString("hex") : null; };

/** Whether `candidate` is the current share token (constant-time). */
export function isShareToken(candidate: string): boolean {
  const t = token();
  return !!t && !!sharedVersion() && timingSafeEqual(digest(candidate), digest(t));
}

let decoded: { raw: string; value: Shared | null } | null = null;
/** The shared version, or null if sharing isn't set up (or the value is malformed). */
export function sharedVersion(): Shared | null {
  const raw = process.env.SHARE_PAYLOAD ?? "";
  if (!raw || !token()) return null;
  if (decoded?.raw !== raw) {
    let value: Shared | null = null;
    try {
      const v = JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as Shared;
      if (typeof v?.label === "string" && Array.isArray(v?.payload?.countries) && Array.isArray(v?.payload?.pillars) && v.payload.meta) value = v;
    } catch { /* malformed: sharing stays off */ }
    decoded = { raw, value };
  }
  return decoded.value;
}
