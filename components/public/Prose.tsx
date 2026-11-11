import type { ReactNode } from "react";
import { ArrowUpRight } from "@/components/ui/icons";

/** Renders the light Markdown used in workbook text fields (headings, paragraphs,
 *  "-"/"1." lists, **bold**, *emphasis*, [links](https://…) and bare URLs) as React
 *  elements. Text is never injected as HTML, and only http(s) links are linked, so
 *  the sanitise-on-ingest guarantee holds. `skipLeadingHeading` drops a heading that
 *  opens the text when the page already titles that section. */
export function Prose({ text, skipLeadingHeading = false, className = "" }: { text: string; skipLeadingHeading?: boolean; className?: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (skipLeadingHeading && blocks.length && /^#{1,6}\s/.test(blocks[0])) blocks.shift();
  return (
    <div className={`prose-doc ${className}`}>
      {blocks.map((b, i) => {
        const h = b.match(/^(#{1,6})\s+(.*)$/);
        if (h && !b.includes("\n")) {
          const Tag = h[1].length <= 2 ? "h3" : "h4";
          return <Tag key={i}>{inline(h[2])}</Tag>;
        }
        const lines = b.split("\n").map((l) => l.trim());
        if (lines.every((l) => /^[-*•]\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*•]\s+/, ""))}</li>)}</ul>;
        if (lines.every((l) => /^\d+[.)]\s+/.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)]\s+/, ""))}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>;
      })}
    </div>
  );
}

const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|(https?:\/\/[^\s)<]+[^\s)<.,;:!?])/g;

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<ExtLink key={k++} href={m[2]}>{m[1]}</ExtLink>);
    else if (m[3]) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[4] || m[5]) out.push(<em key={k++}>{m[4] ?? m[5]}</em>);
    else if (m[6]) out.push(<ExtLink key={k++} href={m[6]}>{m[6]}</ExtLink>);
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="doc-link">
      {children}<ArrowUpRight size={13} className="ml-0.5 inline-block align-[-1px]" /><span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
