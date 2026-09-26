import { cn } from '../lib/cn';

/** Booking reference in mono so it reads unambiguously over the phone; one tap selects it all. */
export function Reference({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('font-mono text-small tracking-wide text-ink select-all', className)}>
      {value}
    </span>
  );
}
