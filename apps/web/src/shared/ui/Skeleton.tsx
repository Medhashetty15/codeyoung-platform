import { cn } from '../lib/cn';

/** Placeholder with the final element's shape and size, so the swap causes no layout shift. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-control', className)} />;
}
