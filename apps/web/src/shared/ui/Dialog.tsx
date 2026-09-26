import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One sentence under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, secondary first then primary: right-aligned on desktop, stacked with primary on top on phones. */
  actions: ReactNode;
  /** A destructive or blocking dialog should not close on an outside press. */
  dismissible?: boolean;
}

/** Centred modal from 640px, bottom sheet below it (doc 07 §6, motion rows 9 and 10). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  dismissible = true,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal={!dismissible}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="motion-backdrop fixed inset-0 z-60 bg-ink/40 dark:bg-canvas/70" />
        <BaseDialog.Viewport className="fixed inset-0 z-60 grid items-end sm:place-items-center sm:p-6">
          <BaseDialog.Popup
            className={cn(
              'motion-dialog flex max-h-[85dvh] w-full flex-col bg-surface shadow-float ring-1 ring-line outline-none',
              'rounded-t-surface pb-[calc(12px+env(safe-area-inset-bottom,0px))]',
              'sm:max-w-md sm:rounded-surface sm:pb-0',
            )}
          >
            <div className="overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6 sm:pt-6">
              <BaseDialog.Title className="text-h2 text-ink">{title}</BaseDialog.Title>
              {Boolean(description) && (
                <BaseDialog.Description className="mt-2 text-body text-ink-muted">
                  {description}
                </BaseDialog.Description>
              )}
              {Boolean(children) && <div className="mt-4">{children}</div>}
            </div>
            <div className="flex flex-col-reverse gap-2 px-5 pt-5 pb-2 sm:flex-row sm:justify-end sm:px-6 sm:pb-6 [&>*]:w-full sm:[&>*]:w-auto">
              {actions}
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogClose = BaseDialog.Close;
