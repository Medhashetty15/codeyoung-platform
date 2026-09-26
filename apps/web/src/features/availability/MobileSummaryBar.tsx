import { useEffect, useRef } from 'react';

import type { Slot } from '@app/contracts';
import { formatDateTime } from '@app/time';

import { Button } from '../../shared/ui/Button';

interface MobileSummaryBarProps {
  slot: Slot | null;
  zone: string;
  locale: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Phones: the chosen time and the next step, pinned above the safe area (doc 05 §5.1). It slides
 * up on the first pick (motion row 7) and publishes its height so toasts sit above it.
 */
export function MobileSummaryBar({
  slot,
  zone,
  locale,
  actionLabel,
  onAction,
}: MobileSummaryBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const visible = slot !== null;

  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !barRef.current) {
      root.style.removeProperty('--sticky-bar-offset');
      return;
    }
    root.style.setProperty('--sticky-bar-offset', `${String(barRef.current.offsetHeight)}px`);
    return () => {
      root.style.removeProperty('--sticky-bar-offset');
    };
  }, [visible]);

  return (
    <div
      ref={barRef}
      data-visible={visible || undefined}
      inert={!visible}
      className="motion-summary-bar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-float lg:hidden"
    >
      <div className="mx-auto flex max-w-content items-center gap-4 px-4 pt-3">
        <p className="min-w-0 flex-1 truncate text-body font-medium text-ink tabular-nums">
          {slot ? formatDateTime(slot.start, zone, locale) : ''}
        </p>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </div>
  );
}
