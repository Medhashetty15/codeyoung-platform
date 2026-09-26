import { useEffect, useState } from 'react';

import { cn } from '../lib/cn';

import { buttonVariants } from './button-variants';
import { CheckIcon, CopyIcon } from './icons';

interface CopyButtonProps {
  value: string;
  label: string;
  onCopied?: () => void;
  onError?: () => void;
  className?: string;
}

const REVERT_AFTER_MS = 2000;

/** Secondary button whose icon morphs Copy to Check for 2s after copying (doc 07 motion row 14). */
export function CopyButton({ value, label, onCopied, onError, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, REVERT_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
    } catch {
      onError?.();
    }
  };

  const iconClassName =
    'absolute inset-0 transition-[opacity,filter,transform] duration-200 ease-out motion-reduce:transition-opacity';

  return (
    <button
      type="button"
      data-copied={copied || undefined}
      onClick={() => void copy()}
      className={cn(buttonVariants({ variant: 'secondary' }), 'group', className)}
    >
      <span aria-hidden className="relative size-5">
        <CopyIcon
          size={20}
          className={cn(
            iconClassName,
            'group-data-copied:scale-75 group-data-copied:opacity-0 group-data-copied:blur-[2px]',
          )}
        />
        <CheckIcon
          size={20}
          className={cn(
            iconClassName,
            'scale-75 text-accent opacity-0 blur-[2px] group-data-copied:scale-100 group-data-copied:opacity-100 group-data-copied:blur-none',
          )}
        />
      </span>
      {label}
    </button>
  );
}
