import type { Metadata } from "next";
import Link from "next/link";
import { IndexMark } from "@/components/admin/AdminMark";
import { ArrowLeft } from "@/components/ui/icons";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Admin" };

/* The admin sign-in. Not linked from the public site (which is embedded elsewhere);
 * admins reach it directly at /admin. Signed-in visitors are sent on by middleware.
 * The background is the public site's grid (.grid-lines) on the off-white page. */
export default function LoginPage() {
  return (
    <main className="login-stage">
      <div aria-hidden className="login-grid grid-lines" />
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center text-center">
          <span className="flex items-center gap-3 text-[18px] font-bold tracking-tight text-ink"><IndexMark size={30} /><span className="ml-1">Country Index</span></span>
          <span className="eyebrow mt-2 !text-[11.5px] !tracking-[0.14em]">Administration portal</span>
        </div>
        <div className="login-card mt-7">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">Welcome back</h1>
          <p className="mt-1 text-[14.5px] leading-relaxed text-muted">Sign in to manage the Country Index.</p>
          <div className="mt-7"><LoginForm /></div>
        </div>
        <div className="mt-6 grid justify-items-center gap-2 text-center">
          <Link href="/" className="login-back"><ArrowLeft size={15} />Back to public site</Link>
          <p className="text-[12.5px] text-muted">Restricted to authorised administrators.</p>
        </div>
      </div>
    </main>
  );
}
