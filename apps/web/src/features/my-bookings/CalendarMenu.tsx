import { lazy, Suspense, useState } from 'react';

import { Button } from '../../shared/ui/Button';
import { CalendarPlusIcon } from '../../shared/ui/icons';

import type { CalendarMenuProps } from './menus';
import { loadMenus } from './menus-loader';

const Menu = lazy(() => loadMenus().then((module) => ({ default: module.CalendarMenu })));

/**
 * "Add to calendar" with the menu code deferred: the same button shows until it arrives, and a
 * press in that moment opens the menu as soon as it can.
 */
export function CalendarMenu({ booking, primary = false }: Omit<CalendarMenuProps, 'defaultOpen'>) {
  const [pressed, setPressed] = useState(false);
  return (
    <Suspense
      fallback={
        <Button
          variant={primary ? 'primary' : 'secondary'}
          icon={<CalendarPlusIcon aria-hidden size={20} />}
          aria-haspopup="menu"
          onPointerDown={() => {
            setPressed(true);
          }}
          onClick={() => {
            setPressed(true);
          }}
        >
          Add to calendar
        </Button>
      }
    >
      <Menu booking={booking} primary={primary} defaultOpen={pressed} />
    </Suspense>
  );
}
