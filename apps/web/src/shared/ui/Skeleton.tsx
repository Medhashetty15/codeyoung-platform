import { cn } from '../lib/cn';

const radii = {
  control: 'rounded-control',
  surface: 'rounded-surface',
  pill: 'rounded-pill',
} as const;

/** Placeholder with the final element's shape and size, so the swap causes no layout shift. */
export function Skeleton({
  className,
  radius = 'control',
}: {
  className?: string;
  radius?: keyof typeof radii;
}) {
  return <div aria-hidden className={cn('skeleton', radii[radius], className)} />;
}
