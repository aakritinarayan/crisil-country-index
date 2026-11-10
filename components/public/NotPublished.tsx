/** Shown on every public route when nothing has been published yet (FLOW §5).
 *  Never an error page, never an empty matrix. */
export function NotPublished() {
  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <span className="eyebrow">Coming soon</span>
        <h1 className="t-h2 mt-6 text-ink">This index has not been <span className="grad-text">published yet</span></h1>
        <p className="t-lead mx-auto mt-4 max-w-[52ch] text-muted">The first edition will appear here once it is released. Please check back later.</p>
      </div>
    </section>
  );
}
