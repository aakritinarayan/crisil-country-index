/** Name of the hint cookie set on admin sign-in (see lib/auth.ts events). */
export const ADMIN_HINT_COOKIE = "ci_admin";
/** Names the version an administrator is previewing (see lib/preview.ts). */
export const PREVIEW_COOKIE = "ci_preview";
/** Outlives the session (30 days) and is cleared only by signing out, so the sign-in page
 *  can tell "your session expired" from a first visit. Content-free; grants nothing. */
export const SESSION_SEEN_COOKIE = "ci_admin_seen";
