/** The neutral Country Index mark: two overlapping discs, no client branding (CONTEXT §7). */
export function IndexMark({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full bg-[var(--brand)]" />
      <span className="absolute inset-y-0 rounded-full bg-[var(--teal)] mix-blend-multiply dark:mix-blend-normal" style={{ left: size * 0.43, right: -size * 0.21 }} />
    </span>
  );
}

/** The mark with an "Admin" tag, so the console is never mistaken for the public site. */
export function AdminMark() {
  return (
    <span className="flex items-center gap-2.5 font-bold tracking-tight text-ink">
      <IndexMark />
      <span className="ml-1">Country Index</span>
      <span className="admin-tag">Admin</span>
    </span>
  );
}
