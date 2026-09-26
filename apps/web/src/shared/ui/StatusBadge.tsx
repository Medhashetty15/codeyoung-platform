import { cn } from '../lib/cn';

import { ArrowRightIcon, CheckIcon, XIcon, type Icon } from './icons';

export type BadgeStatus = 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED';

const badges: Record<BadgeStatus, { label: string; icon: Icon; className: string }> = {
  CONFIRMED: { label: 'Confirmed', icon: CheckIcon, className: 'bg-accent-tint text-accent-ink' },
  CANCELLED: { label: 'Cancelled', icon: XIcon, className: 'bg-sunken text-ink-muted' },
  RESCHEDULED: { label: 'Moved', icon: ArrowRightIcon, className: 'bg-sunken text-ink-muted' },
  COMPLETED: { label: 'Completed', icon: CheckIcon, className: 'bg-sunken text-ink-muted' },
};

/** Pill with icon and label; colour never carries the meaning alone (doc 07 §2.3). */
export function StatusBadge({ status, className }: { status: BadgeStatus; className?: string }) {
  const { label, icon: BadgeIcon, className: toneClassName } = badges[status];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-micro whitespace-nowrap',
        toneClassName,
        className,
      )}
    >
      <BadgeIcon aria-hidden size={14} />
      {label}
    </span>
  );
}
