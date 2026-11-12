import type { Metadata } from "next";
import { AdminMark } from "@/components/admin/AdminMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Admin" };

/* The admin sign-in. Not linked from the public site (which is embedded elsewhere);
 * admins reach it directly at /admin. Signed-in visitors are sent on by middleware. */
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <AdminMark />
        <div className="admin-card mt-6 p-6 sm:p-8">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">Sign in</h1>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">Manage the data behind the Country Index.</p>
          <div className="mt-6"><LoginForm /></div>
        </div>
        <p className="mt-5 text-[13px] text-muted">Restricted to index administrators. The public site is open to everyone.</p>
      </div>
    </main>
  );
}
