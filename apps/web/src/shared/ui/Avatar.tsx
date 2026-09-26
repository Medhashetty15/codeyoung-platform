import { cn } from '../lib/cn';
import { initialsOf } from '../lib/initials';

const sizes = { sm: 'size-8 text-micro', md: 'size-10 text-small', lg: 'size-20 text-h2' } as const;

/** Initials on a neutral disc; the name is exposed to assistive tech, the letters are not. */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-semibold text-ink-muted ring-1 ring-line select-none',
        sizes[size],
        className,
      )}
    >
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );
}
