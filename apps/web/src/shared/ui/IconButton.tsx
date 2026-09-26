import type { ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';

import type { Icon } from './icons';

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'> & {
  icon: Icon;
  /** Required: icon-only controls must have an accessible name. */
  label: string;
};

export function IconButton({
  icon: ButtonIcon,
  label,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'pressable inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink hover:bg-sunken active:bg-sunken disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <ButtonIcon aria-hidden size={20} />
    </button>
  );
}
