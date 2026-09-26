import { lazy, Suspense } from 'react';

import { CalendarBlankIcon } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/Skeleton';

// The form (React Hook Form, zod) only loads in the rare "everything is taken" state.
const WaitlistForm = lazy(() =>
  import('../waitlist').then((module) => ({ default: module.WaitlistForm })),
);

/** Whole horizon full: a composed state with the waitlist instead of a dead end (doc 05 §5.1). */
export function WindowEmpty({ zone }: { zone: string }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-surface bg-sunken px-5 py-6 sm:px-6">
      <CalendarBlankIcon aria-hidden size={32} className="text-ink-muted" />
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-ink">All trial classes for the next two weeks are taken</h2>
        <p className="max-w-prose text-body text-ink-muted">
          Join the waitlist and we will email you as soon as a time opens up.
        </p>
      </div>
      <div className="w-full">
        <Suspense fallback={<Skeleton className="h-44 w-full max-w-form" />}>
          <WaitlistForm zone={zone} />
        </Suspense>
      </div>
    </section>
  );
}
