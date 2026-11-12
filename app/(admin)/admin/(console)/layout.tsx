import { Suspense } from "react";
import Link from "next/link";
import { AdminMark } from "@/components/admin/AdminMark";
import { ArrowUpRight } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

/* Console chrome for every signed-in admin page: the mark, a way out to the public site,
 * and who is signed in. The session read streams in behind Suspense (Cache Components:
 * a request read can't be part of the static shell); the shell itself holds no data. */
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>
      <header className="admin-bar sticky top-0 z-40">
        <div className="wrap flex h-16 items-center gap-4">
          <Link href="/admin" aria-label="Admin overview"><AdminMark /></Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-link hidden items-center gap-1 text-[14px] sm:inline-flex">
              Public site<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span>
            </Link>
            <Suspense fallback={<span className="h-9 w-24" />}><Account /></Suspense>
          </div>
        </div>
      </header>
      <main id="admin-main" className="wrap pb-16 pt-8 sm:pt-10">{children}</main>
    </>
  );
}

async function Account() {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-3 sm:border-l sm:border-line sm:pl-4">
      <span className="hidden text-right leading-tight md:block">
        <span className="block text-[13.5px] font-semibold text-ink">{admin.name}</span>
        <span className="block text-[12.5px] text-muted">{admin.email}</span>
      </span>
      <form action={logout}>
        <button type="submit" className="admin-btn-quiet">Sign out</button>
      </form>
    </div>
  );
}
