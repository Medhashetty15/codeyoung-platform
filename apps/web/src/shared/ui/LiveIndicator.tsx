/** The product's only pulsing element, shown only while a class is actually live (doc 07 row 18). */
export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill bg-accent-tint px-3 py-1 text-micro text-accent-ink">
      <span aria-hidden className="live-pulse size-2 rounded-full bg-accent" />
      Live
    </span>
  );
}
