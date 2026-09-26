import { lazy, Suspense, useState } from 'react';

import { Button } from '../../shared/ui/Button';
import { CalendarPlusIcon } from '../../shared/ui/icons';

import type { CalendarMenuProps } from './menus';
import { loadMenus } from './menus-loader';

const Menu = lazy(() => loadMenus().then((module) => ({ default: module.CalendarMenu })));

const prefetch = () => {
  void loadMenus();
};

/**
 * "Add to calendar" with the menu code deferred. The plain button stays until it is pressed; the
 * press mounts the real menu already open. Swapping controls under a pointer mid-click is what
 * made first clicks get lost, so the swap only ever happens after a click has finished.
 */
export function CalendarMenu({ booking, primary = false }: Omit<CalendarMenuProps, 'defaultOpen'>) {
  const [active, setActive] = useState(false);
  const idle = (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      icon={<CalendarPlusIcon aria-hidden size={20} />}
      aria-haspopup="menu"
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onClick={() => {
        setActive(true);
      }}
    >
      Add to calendar
    </Button>
  );
  if (!active) return idle;
  return (
    <Suspense fallback={idle}>
      <Menu booking={booking} primary={primary} defaultOpen />
    </Suspense>
  );
}
