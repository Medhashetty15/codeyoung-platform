import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

import { XIcon } from './icons';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet for phone navigation and pickers (doc 07 §6, motion row 10). */
export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="motion-backdrop fixed inset-0 z-60 bg-ink/40 dark:bg-canvas/70" />
        <BaseDialog.Viewport className="fixed inset-0 z-60 grid items-end">
          <BaseDialog.Popup className="motion-dialog flex max-h-[85dvh] w-full flex-col rounded-t-surface bg-surface pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-float ring-1 ring-line outline-none sm:mx-auto sm:max-w-md sm:rounded-surface sm:pb-3">
            <div className="flex items-center justify-between gap-4 px-5 pt-3">
              <BaseDialog.Title className="text-h3 font-bold text-ink">{title}</BaseDialog.Title>
              <BaseDialog.Close
                aria-label="Close"
                className="pressable -mr-2 flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-sunken"
              >
                <XIcon aria-hidden size={20} />
              </BaseDialog.Close>
            </div>
            <div className="overflow-y-auto overscroll-contain px-3 pt-1">{children}</div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
