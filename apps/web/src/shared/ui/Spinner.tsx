import { cn } from '../lib/cn';

/** 14px inline spinner for pending buttons only; page loads use skeletons (doc 07 §6). */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:[animation-duration:2s]',
        className,
      )}
    />
  );
}
