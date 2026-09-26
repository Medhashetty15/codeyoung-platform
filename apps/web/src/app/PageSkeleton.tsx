import { Skeleton } from '../shared/ui/Skeleton';

/** Protected routes render this while the boot refresh settles (doc 05 §10). */
export function PageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 sm:py-10"
    >
      <Skeleton className="h-9 w-56" />
      <Skeleton radius="surface" className="h-24 w-full" />
      <Skeleton radius="surface" className="h-24 w-full" />
    </div>
  );
}
