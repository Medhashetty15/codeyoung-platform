import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '../lib/cn';

import { buttonVariants } from './button-variants';
import { InlineSpinner } from './Spinner';

type ButtonProps = ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Leading icon (20px); replaced by the spinner while pending. */
    icon?: ReactNode;
    /** Keeps the label, shows a spinner, keeps the width and ignores repeat presses. */
    pending?: boolean;
  };

/**
 * Button (doc 07 §6). While pending, an invisible copy of the idle content keeps the button's
 * width, and the spinner plus label are laid over it; the extra room comes out of the padding,
 * so nothing around the button moves.
 */
export function Button({
  className,
  variant,
  size,
  icon,
  pending = false,
  children,
  type = 'button',
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-disabled={pending || undefined}
      data-pending={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {pending ? (
        <>
          <span aria-hidden className="invisible inline-flex items-center gap-2">
            {icon}
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <InlineSpinner />
            {children}
          </span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
