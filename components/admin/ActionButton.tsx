import Link from "next/link";
import type { ComponentType } from "react";
import type { ActionState } from "@/lib/admin/permissions";

/** A version action. When unavailable it stays focusable (aria-disabled, not disabled) so
 *  keyboard and screen-reader users can still learn why, from the tooltip and description. */
export function ActionButton({ state, label, icon: Icon, href, tone = "quiet", reasonId }: {
  state: ActionState; label: string; icon: ComponentType<{ size?: number }>; href?: string; tone?: "quiet" | "primary"; reasonId: string;
}) {
  const cls = `act-btn ${tone === "primary" ? "is-primary" : ""}`;
  if (state.enabled && href) return <Link href={href} className={cls}><Icon size={16} />{label}</Link>;
  return (
    <span className="act-wrap" data-tip={state.reason}>
      <button type="button" aria-disabled="true" aria-describedby={reasonId} className={cls}><Icon size={16} />{label}</button>
      <span id={reasonId} className="sr-only">{state.reason}</span>
    </span>
  );
}
