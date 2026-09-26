import { Link } from 'react-router';

/** Text wordmark; the brand's real logo can replace it here (ADR 0015). */
export function Wordmark() {
  return (
    <Link
      to="/"
      className="pressable -mx-2 inline-flex h-11 items-center rounded-control px-2 text-h3 font-bold tracking-tight text-ink"
    >
      codeyoung
      <span className="sr-only">, home</span>
    </Link>
  );
}
