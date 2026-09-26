import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';

import { useKeyboardModality } from '../hooks/useKeyboardModality';
import { cn } from '../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  panel: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

const tabClassName =
  'flex h-10 flex-1 items-center justify-center rounded-[6px] px-4 text-small font-medium whitespace-nowrap';

/**
 * Segmented tabs with the clip-path indicator (doc 07 motion row 13): an active-styled copy of the
 * labels sits on top and is clipped to the selected tab, so text colour and fill change in sync.
 */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: TabsProps<T>) {
  const modality = useKeyboardModality();
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => {
        onValueChange(next as T);
      }}
      className={className}
    >
      <BaseTabs.List
        aria-label={label}
        {...modality}
        className="group/tabs relative flex rounded-control bg-sunken p-1"
      >
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className={cn(tabClassName, 'pressable text-ink-muted hover:text-ink')}
          >
            {item.label}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 flex p-1',
            '[clip-path:inset(var(--active-tab-top,0)_var(--active-tab-right,100%)_var(--active-tab-bottom,0)_var(--active-tab-left,0)_round_6px)]',
            'transition-[clip-path] duration-250 ease-in-out group-data-keyboard/tabs:transition-none motion-reduce:transition-none',
          )}
        >
          {items.map((item) => (
            <span key={item.value} className={cn(tabClassName, 'bg-surface text-ink shadow-float')}>
              {item.label}
            </span>
          ))}
        </BaseTabs.Indicator>
      </BaseTabs.List>
      {items.map((item) => (
        <BaseTabs.Panel key={item.value} value={item.value} className="pt-6 outline-none">
          {item.panel}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
