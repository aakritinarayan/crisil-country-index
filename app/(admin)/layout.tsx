import type { Metadata } from "next";

/* The admin area: its own route group, so none of the public site's layout (closing card,
 * skip link target) applies, and nothing on the public site links here. Never indexed. */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Country Index" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/">) {
  return <div className="admin min-h-dvh">{children}</div>;
}
