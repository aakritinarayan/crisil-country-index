import { getPublishedSnapshot } from "@/lib/data";

/* No site header or footer: the public site is embedded in a host page (iframe), which
 * provides its own chrome. Each page carries the sample-data notice in its own header;
 * the disclaimer stays here so it is on every page (CLAUDE.md: disclaimer slot). */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const snapshot = await getPublishedSnapshot();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>

      <main id="main" className="flex-1">{children}</main>

      <section aria-labelledby="disclaimer-h" className="wrap">
        <div className="border-t border-line py-6">
          <h2 id="disclaimer-h" className="label text-muted">Disclaimer</h2>
          <p className="mt-1.5 max-w-[90ch] text-[13px] leading-relaxed text-muted">
            {snapshot?.meta.disclaimer || "This index is not a credit rating."}
          </p>
        </div>
      </section>
    </div>
  );
}
