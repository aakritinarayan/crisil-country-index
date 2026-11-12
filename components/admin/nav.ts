import type { ComponentType } from "react";
import { History, LayoutGrid, UploadIcon } from "@/components/ui/icons";
import type { Capability } from "@/lib/admin/permissions";

/* Admin navigation, as configuration: adding a module is one entry here (and its route).
 * `requires` names the capability the module needs; it is not enforced yet (every
 * administrator has every capability — lib/admin/permissions.ts) and is the hook for
 * hiding entries once roles are confirmed. */
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  match: (path: string) => boolean;
  requires?: Capability;
};

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, match: (p) => p === "/admin" },
  { href: "/admin/upload", label: "Upload data", icon: UploadIcon, match: (p) => p.startsWith("/admin/upload"), requires: "upload" },
  { href: "/admin/versions", label: "Version history", icon: History, match: (p) => p.startsWith("/admin/versions") },
];
