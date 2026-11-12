"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

/** Sign in with the shared admin account. Returns an error message for the form, or
 *  redirects (by throwing) on success. Only same-site /admin paths are honoured as the
 *  return address. */
export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const back = String(form.get("callbackUrl") ?? "");
  let redirectTo = /^\/admin(\/|$|\?)/.test(back) && !back.startsWith("/admin/login") ? back : "/admin";
  // a preview link is a route handler that switches the browser into preview; after a
  // sign-in the client router can't follow it, so return to that version instead
  const preview = redirectTo.match(/^\/admin\/preview\/([\w-]+)/);
  if (preview) redirectTo = `/admin/versions/${preview[1]}`;
  try {
    await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo });
    return null;
  } catch (e) {
    if (e instanceof AuthError) return e.type === "CredentialsSignin" ? "That email and password don’t match the admin account." : "Sign-in failed. Please try again.";
    throw e; // the success redirect
  }
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
