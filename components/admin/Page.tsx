import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/ui/icons";

/** Page title, one-line description and the page's primary action on the right. */
export function PageHead({ title, description, action, back }: { title: ReactNode; description?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-7">
      {back && <Link href={back.href} className="admin-link mb-3 inline-block text-[13.5px]">← {back.label}</Link>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.6rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.025em] text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-[68ch] text-[15px] text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/** The one lime primary action (the public site's hero button). */
export function UploadButton() {
  return <Link href="/admin/upload" className="hero-btn hero-btn-primary !h-11 !min-w-0 gap-6">Upload workbook<span className="box !size-8" aria-hidden><ArrowRight size={15} /></span></Link>;
}

export function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </div>
  );
}

/** Shown wherever demonstration records appear, so nobody mistakes them for real uploads. */
export function DemoNotice() {
  return (
    <div role="note" className="demo-note mb-7">
      <p><strong className="font-semibold text-ink">Demonstration records.</strong> The versions, administrators and activity below are fictional — nothing here changed the public site, which still shows the bundled sample dataset.</p>
    </div>
  );
}
