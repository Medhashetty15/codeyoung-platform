/**
 * The booking-confirmed mark (doc 07 motion row 16, the rare delight tier): the disc settles in,
 * then the check draws itself. Reduced motion shows the finished check with an opacity fade only.
 */
export function ConfirmedMark() {
  return (
    <svg
      viewBox="0 0 56 56"
      width={56}
      height={56}
      aria-hidden
      className="confirmed-mark text-accent"
    >
      <circle className="confirmed-mark-disc" cx="28" cy="28" r="28" fill="var(--accent-tint)" />
      <path
        className="confirmed-mark-check"
        d="M17 29.5l7 7 15-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}
