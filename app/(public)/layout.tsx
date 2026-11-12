import { getPublishedSnapshot } from "@/lib/data";
import { ClosingSection } from "@/components/public/ClosingSection";

/* No site header or footer: the public site is embedded in a host page (iframe), which
 * provides its own chrome. Each page carries the sample-data notice in its own header;
 * the closing band (methodology introduction + disclaimer) ends every page. */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const snapshot = await getPublishedSnapshot();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>

      <main id="main" className="flex-1">{children}</main>

      <ClosingSection disclaimer={snapshot?.meta.disclaimer || "This index is not a credit rating."} />
    </div>
  );
}
