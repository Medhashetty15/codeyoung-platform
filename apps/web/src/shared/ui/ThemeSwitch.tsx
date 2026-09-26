import { useId } from 'react';

import { cn } from '../lib/cn';
import { useTheme, type ThemePreference } from '../theme/theme';

import { MonitorIcon, MoonIcon, SunIcon, type Icon } from './icons';

const OPTIONS: { value: ThemePreference; label: string; icon: Icon }[] = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

/**
 * System / Light / Dark switch (doc 05 §3). Native radio inputs: arrow keys, one tab stop and form
 * semantics for free, and no primitives library in the first page load. The switch never animates.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const groupId = useId();
  return (
    <fieldset className={cn('inline-flex rounded-control bg-sunken p-1', className)}>
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
        <label
          key={value}
          className="pressable relative flex h-9 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-small font-medium text-ink-muted select-none hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-float has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name={groupId}
            value={value}
            aria-label={label}
            checked={preference === value}
            onChange={() => {
              setPreference(value);
            }}
            className="sr-only"
          />
          <OptionIcon aria-hidden size={16} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
