import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The signature double-bezel frame around *the time* (doc 07 §4). Used in exactly two places:
 * the landing hero "Next free times" panel and the booking summary panel.
 */
export function TimeTray({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-tray bg-sunken p-1.5 ring-1 ring-line', className)}>
      <div className="rounded-surface bg-surface p-5 inset-shadow-highlight ring-1 ring-line sm:p-6">
        {children}
      </div>
    </div>
  );
}
