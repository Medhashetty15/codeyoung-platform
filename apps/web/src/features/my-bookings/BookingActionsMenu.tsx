import { lazy, Suspense, useState } from 'react';

import { IconButton } from '../../shared/ui/IconButton';
import { DotsThreeIcon } from '../../shared/ui/icons';

import type { BookingActionsMenuProps } from './menus';
import { loadMenus } from './menus-loader';

const Menu = lazy(() => loadMenus().then((module) => ({ default: module.BookingActionsMenu })));

/** The row's "···" menu with its code deferred (see CalendarMenu). */
export function BookingActionsMenu({
  booking,
  onCancel,
}: Omit<BookingActionsMenuProps, 'defaultOpen'>) {
  const [pressed, setPressed] = useState(false);
  return (
    <Suspense
      fallback={
        <IconButton
          icon={DotsThreeIcon}
          label={`More actions for ${booking.student.firstName}'s trial`}
          aria-haspopup="menu"
          onPointerDown={() => {
            setPressed(true);
          }}
          onClick={() => {
            setPressed(true);
          }}
        />
      }
    >
      <Menu booking={booking} onCancel={onCancel} defaultOpen={pressed} />
    </Suspense>
  );
}
