/** The neutral Country Index mark (two overlapping discs, no client branding — CONTEXT §7)
 *  with an "Admin" tag, so the console is never mistaken for the public site. */
export function AdminMark() {
  return (
    <span className="flex items-center gap-2.5 font-bold tracking-tight text-ink">
      <span aria-hidden className="relative size-7 shrink-0">
        <span className="absolute inset-0 rounded-full bg-[var(--brand)]" />
        <span className="absolute inset-y-0 left-3 right-[-6px] rounded-full bg-[var(--teal)] mix-blend-multiply dark:mix-blend-normal" />
      </span>
      <span className="ml-1">Country Index</span>
      <span className="admin-tag">Admin</span>
    </span>
  );
}
