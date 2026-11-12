import { Suspense } from "react";
import Link from "next/link";
import { AdminMark } from "@/components/admin/AdminMark";
import { AccountMenu } from "@/components/admin/AccountMenu";
import { MobileNav, Sidebar } from "@/components/admin/Sidebar";
import { ArrowUpRight } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/auth";

/* The console frame for every signed-in admin page: a compact header (identity, public
 * site, account), a collapsible navigation rail (a drawer on phones) and the workspace.
 * The session read streams in behind Suspense (Cache Components: a request read can't
 * be part of the static shell); the shell itself holds no data. */
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>
      <header className="admin-bar sticky top-0 z-40">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <Suspense fallback={<span className="block w-9 md:hidden" />}><MobileNav /></Suspense>
          <Link href="/admin" aria-label="Country Index admin, overview" className="rounded-[4px] px-1.5 py-1"><AdminMark /></Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-link hidden items-center gap-1 px-2 text-[13.5px] sm:inline-flex">
              Public site<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span>
            </Link>
            <Suspense fallback={<span className="block h-9 w-9" />}><Account /></Suspense>
          </div>
        </div>
      </header>
      <div className="flex">
        {/* the active item reads the URL, which on dynamic routes is request data */}
        <Suspense fallback={<div className="admin-side hidden md:flex" />}><Sidebar /></Suspense>
        <main id="admin-main" className="min-w-0 flex-1 px-4 pb-16 pt-7 sm:px-6 lg:px-10 lg:pt-9">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
    </>
  );
}

async function Account() {
  const admin = await requireAdmin();
  return <AccountMenu name={admin.name} email={admin.email} />;
}
