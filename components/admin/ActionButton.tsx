import Link from "next/link";
import type { ComponentType } from "react";
import type { ActionState } from "@/lib/admin/permissions";

/** A version action. When unavailable it stays focusable (aria-disabled, not disabled) so
 *  keyboard and screen-reader users can still learn why, from the tooltip and description. */
export function ActionButton({ state, label, icon: Icon, href, newTab = false, download = false, tone = "quiet", reasonId }: {
  state: ActionState; label: string; icon: ComponentType<{ size?: number }>; href?: string; newTab?: boolean; download?: boolean; tone?: "quiet" | "primary"; reasonId: string;
}) {
  const cls = `act-btn ${tone === "primary" ? "is-primary" : ""}`;
  // preview opens the public site in a new tab via a plain link: never prefetched, since
  // following it switches this browser into preview
  if (state.enabled && href && newTab) return <a href={href} target="_blank" rel="noopener" className={cls}><Icon size={16} />{label}<span className="sr-only"> (opens in a new tab)</span></a>;
  if (state.enabled && href && download) return <a href={href} download className={cls}><Icon size={16} />{label}</a>;
  if (state.enabled && href) return <Link href={href} className={cls}><Icon size={16} />{label}</Link>;
  return (
    <span className="act-wrap" data-tip={state.reason}>
      <button type="button" aria-disabled="true" aria-describedby={reasonId} className={cls}><Icon size={16} />{label}</button>
      <span id={reasonId} className="sr-only">{state.reason}</span>
    </span>
  );
}
