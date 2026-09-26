import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

import { cn } from '../lib/cn';

import { controlClassName, FieldContext, useFieldControl } from './field-context';
import { CaretDownIcon, WarningCircleIcon } from './icons';

interface FieldProps {
  label: ReactNode;
  /** Helper text, shown between the label and the control. */
  description?: ReactNode;
  /** Error message; when set the control is marked invalid and describes itself with it. */
  error?: string | undefined;
  /** Shown after the label for fields that can be left empty. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label above, helper below the label, error below the control (doc 07 §6). */
export function Field({
  label,
  description,
  error,
  optional = false,
  className,
  children,
}: FieldProps) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const descriptionId = description ? `${baseId}-description` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext value={{ controlId, describedBy, invalid: Boolean(error) }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={controlId} className="text-small font-medium text-ink">
          {label}
          {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
        </label>
        {Boolean(description) && (
          <p id={descriptionId} className="text-small text-ink-muted">
            {description}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} className="flex items-start gap-1.5 text-small text-danger">
            <WarningCircleIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext>
  );
}

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return (
    <input {...useFieldControl()} className={cn(controlClassName, 'h-11', className)} {...props} />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<'textarea'>) {
  return (
    <textarea
      {...useFieldControl()}
      className={cn(controlClassName, 'min-h-24 py-2.5', className)}
      {...props}
    />
  );
}

/** Native select: the platform picker is the right control on phones (age, cancel reason). */
export function NativeSelect({ className, children, ...props }: ComponentPropsWithRef<'select'>) {
  return (
    <div className="relative">
      <select
        {...useFieldControl()}
        className={cn(controlClassName, 'h-11 appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <CaretDownIcon
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
