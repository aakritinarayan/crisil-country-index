"use client";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { Alert, ArrowRight, Eye, EyeOff } from "@/components/ui/icons";
import { SESSION_SEEN_COOKIE } from "@/lib/admin/hint";
import { login } from "../actions";

type Field = "email" | "password";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* "Your session has expired": this browser signed in before (the long-lived cookie set on
 * sign-in, cleared on sign-out) but has no session now — otherwise middleware wouldn't
 * have shown this page. */
const seen = () => document.cookie.split("; ").some((c) => c === `${SESSION_SEEN_COOKIE}=1`);
const noop = () => () => {};

/** Email + password for the admin account. Fields are checked here first (inline, under
 *  each field), then on the server. The return address (?callbackUrl, set by middleware)
 *  is read at submit time and checked again on the server. */
export function LoginForm() {
  const [error, dispatch, pending] = useActionState(login, null);
  const [invalid, setInvalid] = useState<Partial<Record<Field, string>>>({});
  const [show, setShow] = useState(false);
  // controlled, so a failed attempt keeps the email (React resets uncontrolled fields after
  // a form action); the password is cleared, as it should be
  const [email, setEmail] = useState("");
  const expired = useSyncExternalStore(noop, seen, () => false);
  const form = useRef<HTMLFormElement>(null);

  const check = (data: FormData) => {
    const email = String(data.get("email") ?? "").trim();
    const next: Partial<Record<Field, string>> = {};
    if (!email) next.email = "Enter your email address.";
    else if (!EMAIL.test(email)) next.email = "Enter a valid email address, like name@example.com.";
    if (!String(data.get("password") ?? "")) next.password = "Enter your password.";
    return next;
  };

  const submit = (data: FormData) => {
    if (pending) return;                                              // no double submits
    const next = check(data);
    setInvalid(next);
    const first = (Object.keys(next) as Field[])[0];
    if (first) { form.current?.querySelector<HTMLInputElement>(`[name=${first}]`)?.focus(); return; }
    data.set("email", String(data.get("email")).trim());
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    if (cb) { try { const u = new URL(cb, window.location.origin); if (u.origin === window.location.origin) data.set("callbackUrl", u.pathname + u.search); } catch {} }
    dispatch(data);
  };

  const clear = (f: Field) => () => invalid[f] && setInvalid((x) => ({ ...x, [f]: undefined }));
  const described = (f: Field) => [invalid[f] && `${f}-msg`, error && "login-error"].filter(Boolean).join(" ") || undefined;
  // the server's answer wins once there is one; the expiry note is for the first attempt
  const banner = error ?? (expired ? "Your session has expired. Please sign in again." : null);

  return (
    <form ref={form} action={submit} noValidate aria-busy={pending} className="grid gap-5">
      {banner && (
        <p id="login-error" role={error ? "alert" : "status"} className={error ? "login-msg" : "login-note"}>
          {error && <Alert size={16} className="mt-px shrink-0" />}{banner}
        </p>
      )}
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-[13.5px] font-semibold text-ink">Email address</label>
        <input id="email" name="email" type="email" inputMode="email" required autoComplete="username" autoCapitalize="none" spellCheck={false}
          placeholder="Enter your email address" className="login-field" value={email}
          onChange={(e) => { setEmail(e.target.value); clear("email")(); }}
          aria-invalid={!!invalid.email || undefined} aria-describedby={described("email")} />
        {invalid.email && <p id="email-msg" className="login-msg">{invalid.email}</p>}
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-[13.5px] font-semibold text-ink">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} required autoComplete="current-password"
            placeholder="Enter your password" className="login-field !pr-12" defaultValue=""
            aria-invalid={!!invalid.password || undefined} aria-describedby={described("password")} onInput={clear("password")} />
          <button type="button" onClick={() => setShow((s) => !s)} className="login-eye" aria-pressed={show} aria-controls="password"
            aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {invalid.password && <p id="password-msg" className="login-msg">{invalid.password}</p>}
      </div>
      <button type="submit" disabled={pending} className="hero-btn hero-btn-primary login-btn mt-1">
        {pending ? "Signing in…" : "Sign in"}<span className="box" aria-hidden><ArrowRight size={16} /></span>
      </button>
    </form>
  );
}
