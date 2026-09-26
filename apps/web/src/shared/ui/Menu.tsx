import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn';

export const popupSurfaceClassName =
  'motion-popover rounded-surface bg-surface p-1.5 shadow-float ring-1 ring-line outline-none';

interface MenuProps {
  /** The trigger element, e.g. <Button variant="secondary" />; it receives the menu's props. */
  trigger: ComponentProps<typeof BaseMenu.Trigger>['render'];
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}

/** Origin-aware menu (doc 07 §6, motion row 8). */
export function Menu({ trigger, children, align = 'start' }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6} align={align} className="z-50">
          <BaseMenu.Popup className={cn(popupSurfaceClassName, 'min-w-52')}>
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

const itemClassName =
  'flex h-11 cursor-default items-center gap-3 rounded-control px-3 text-body text-ink outline-none select-none data-highlighted:bg-sunken sm:h-10';

export function MenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof BaseMenu.Item> & { tone?: 'default' | 'danger' }) {
  return (
    <BaseMenu.Item
      className={cn(itemClassName, tone === 'danger' && 'text-danger', className)}
      {...props}
    />
  );
}

export function MenuLinkItem({ className, ...props }: ComponentProps<typeof BaseMenu.LinkItem>) {
  return <BaseMenu.LinkItem className={cn(itemClassName, className)} {...props} />;
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="mx-1.5 my-1 h-px bg-line" />;
}
