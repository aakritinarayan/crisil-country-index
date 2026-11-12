import { ClosingSection } from "@/components/public/ClosingSection";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { AdminShortcut } from "@/components/public/AdminShortcut";
import { PreviewBar } from "@/components/public/PreviewBar";

/* No site header or footer: the public site is embedded in a host page (iframe), which
 * provides its own chrome. Each page carries the sample-data notice in its own header;
 * the closing card (methodology introduction) ends every page. The full disclaimer
 * lives on /methodology — the per-page disclaimer was removed at the client's request. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>

      <PreviewBar />
      <main id="main" className="flex-1">{children}</main>

      <ClosingSection />
      <ThemeToggle />
      <AdminShortcut />
    </div>
  );
}
