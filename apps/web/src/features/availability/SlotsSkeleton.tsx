import { Skeleton } from '../../shared/ui/Skeleton';

/** Final-shape placeholders for the date strip and slot grid (doc 05 §5.1, doc 07 §6). */
export function SlotsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading available times" className="flex flex-col gap-6">
      <div className="-mx-4 flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-18 w-16 shrink-0" />
        ))}
      </div>
      <Skeleton className="h-6 w-28" />
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
    </div>
  );
}
