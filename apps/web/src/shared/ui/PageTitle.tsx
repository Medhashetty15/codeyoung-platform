import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The page's h1. Focus moves here on every route change so screen readers announce the new page
 * (doc 05 §12.3); tabIndex -1 makes it focusable without adding a tab stop.
 */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 tabIndex={-1} data-page-title className={cn('text-h1 text-ink outline-none', className)}>
      {children}
    </h1>
  );
}
