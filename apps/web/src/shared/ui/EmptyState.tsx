import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

import type { Icon } from './icons';

interface EmptyStateProps {
  icon: Icon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Composed, left-aligned empty state: icon, one-line title, one sentence, one action (doc 07 §6). */
export function EmptyState({
  icon: EmptyIcon,
  title,
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-2 py-2', className)}>
      <EmptyIcon aria-hidden size={32} className="text-ink-muted" />
      <h3 className="mt-1 text-h3 text-ink">{title}</h3>
      <p className="max-w-prose text-small text-ink-muted">{children}</p>
      {Boolean(action) && <div className="mt-2">{action}</div>}
    </div>
  );
}
