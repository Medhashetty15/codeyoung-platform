import { Link } from 'react-router';

import { useKeyboardModality } from '../hooks/useKeyboardModality';
import { cn } from '../lib/cn';

export interface SegmentedNavItem {
  label: string;
  to: string;
  active: boolean;
}

/**
 * Tabs that are really links (the choice lives in the URL): the Tabs look without a primitives
 * library. Items share the width equally, so the indicator slides by its own width (transform
 * only, doc 07 motion row 13); keyboard-driven changes jump instead of sliding.
 */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  label: string;
  items: SegmentedNavItem[];
  className?: string;
}) {
  const modality = useKeyboardModality();
  const index = Math.max(
    0,
    items.findIndex((item) => item.active),
  );
  return (
    <nav aria-label={label} className={className}>
      <ul
        {...modality.props}
        className="group/seg relative grid auto-cols-fr grid-flow-col rounded-control bg-sunken p-1"
      >
        <li
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 rounded-[6px] bg-surface shadow-float transition-transform duration-250 ease-in-out group-data-keyboard/seg:transition-none motion-reduce:transition-none"
          style={{
            width: `calc((100% - 0.5rem) / ${String(items.length)})`,
            transform: `translateX(${String(index * 100)}%)`,
          }}
        />
        {items.map((item) => (
          <li key={item.to} className="relative">
            <Link
              to={item.to}
              replace
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'pressable flex h-10 items-center justify-center rounded-[6px] px-4 text-small font-medium whitespace-nowrap transition-colors duration-(--dur-color)',
                item.active ? 'text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
