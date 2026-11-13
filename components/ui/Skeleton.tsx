import type { CSSProperties, ReactNode } from "react";

/* Skeleton primitives: placeholders shaped like the content they stand in for, shown only
 * while that content is genuinely loading. Decorative (aria-hidden); the region that holds
 * them carries aria-busy and one status message (Loading). Colours are theme tokens
 * (--skel, --skel-hi); .skel-on-dark adapts them to the always-dark surfaces (hero, country
 * header). The shimmer stops under prefers-reduced-motion. */

type P = { className?: string; style?: CSSProperties };

/** A block: give it the content's size. */
export const Skel = ({ className = "", style }: P) => <span aria-hidden className={`skel ${className}`} style={style} />;

/** Lines of text: widths as percentages; the last line is usually shorter. */
export function SkelText({ widths = [100, 96, 68], line = "h-3.5", gap = "gap-2.5", className = "" }: { widths?: number[]; line?: string; gap?: string; className?: string }) {
  return (
    <span aria-hidden className={`grid ${gap} ${className}`}>
      {widths.map((w, i) => <Skel key={i} className={`block ${line}`} style={{ width: `${w}%` }} />)}
    </span>
  );
}

/** A score chip (numeral + band colour) at the size the real chip takes. */
export const SkelChip = ({ className = "" }: { className?: string }) => <Skel className={`inline-block h-7 w-14 ${className}`} />;

/** A region that is loading: aria-busy, and a single polite status for assistive tech. */
export function Loading({ label, children, className = "", as: Tag = "div" }: { label: string; children: ReactNode; className?: string; as?: "div" | "section" }) {
  return (
    <Tag aria-busy="true" className={className}>
      <span role="status" className="sr-only">{label}</span>
      {children}
    </Tag>
  );
}
