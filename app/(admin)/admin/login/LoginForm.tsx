"use client";
import { useActionState } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { login } from "../actions";

/** Email + password for the shared admin account. The return address (?callbackUrl,
 *  set by middleware) is read at submit time and checked again on the server. */
export function LoginForm() {
  const [error, dispatch, pending] = useActionState(login, null);

  const submit = (form: FormData) => {
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    if (cb) { try { const u = new URL(cb, window.location.origin); if (u.origin === window.location.origin) form.set("callbackUrl", u.pathname + u.search); } catch {} }
    dispatch(form);
  };

  return (
    <form action={submit} className="grid gap-5" noValidate={false}>
      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-semibold text-ink">Email</span>
        <input name="email" type="email" required autoComplete="username" autoFocus className="admin-field" aria-describedby={error ? "login-error" : undefined} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-semibold text-ink">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="admin-field" aria-describedby={error ? "login-error" : undefined} />
      </label>
      {error && <p id="login-error" role="alert" className="admin-error">{error}</p>}
      <button type="submit" disabled={pending} className="btn mt-1 w-full justify-between disabled:cursor-wait disabled:opacity-70">
        {pending ? "Signing in…" : "Sign in"}<span className="box" aria-hidden><ArrowRight size={16} /></span>
      </button>
    </form>
  );
}
