/** Name of the hint cookie set on admin sign-in (see lib/auth.ts events). */
export const ADMIN_HINT_COOKIE = "ci_admin";
/** Names the version an administrator is previewing (see lib/preview.ts). */
export const PREVIEW_COOKIE = "ci_preview";
/** Outlives the session (30 days) and is cleared only by signing out, so the sign-in page
 *  can tell "your session expired" from a first visit. Content-free; grants nothing. */
export const SESSION_SEEN_COOKIE = "ci_admin_seen";
/** Set by a share link (/share/<token>): a digest of the current share token, so changing
 *  the token revokes every browser that opened the old link (lib/share.ts). */
export const SHARE_COOKIE = "ci_share";
