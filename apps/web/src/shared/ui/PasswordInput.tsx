import { useId, useState, type ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';

import { controlClassName, useFieldControl } from './field-context';
import { CheckIcon, EyeIcon, EyeSlashIcon } from './icons';

export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

type PasswordInputProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** Live policy checklist (length, not common, not your email); omit for the login field. */
  rules?: PasswordRule[];
};

/** Password input with a show/hide toggle and an optional live checklist (doc 07 §6). Use inside <Field>. */
export function PasswordInput({ rules, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const rulesId = useId();
  const field = useFieldControl();
  const describedBy =
    [field['aria-describedby'], rules ? rulesId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <div className="relative">
        <input
          {...field}
          aria-describedby={describedBy}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(controlClassName, 'h-11 pr-12', className)}
          {...props}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => {
            setVisible((current) => !current);
          }}
          className="pressable absolute top-0 right-0 flex size-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
        >
          {visible ? <EyeSlashIcon aria-hidden size={20} /> : <EyeIcon aria-hidden size={20} />}
        </button>
      </div>
      {rules && (
        <ul id={rulesId} className="flex flex-col gap-1 text-small">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                'flex items-center gap-2 transition-colors duration-(--dur-color)',
                rule.met ? 'text-accent-ink' : 'text-ink-muted',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-4 items-center justify-center rounded-full border transition-colors duration-(--dur-color)',
                  rule.met ? 'border-accent bg-accent text-on-accent' : 'border-line-control',
                )}
              >
                {rule.met && <CheckIcon size={10} />}
              </span>
              {rule.label}
              <span className="sr-only">{rule.met ? ' (done)' : ' (not yet)'}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
