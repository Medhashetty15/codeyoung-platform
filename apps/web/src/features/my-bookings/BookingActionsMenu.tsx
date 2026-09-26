import { lazy, Suspense, useState } from 'react';

import { IconButton } from '../../shared/ui/IconButton';
import { DotsThreeIcon } from '../../shared/ui/icons';

import type { BookingActionsMenuProps } from './menus';
import { loadMenus } from './menus-loader';

const Menu = lazy(() => loadMenus().then((module) => ({ default: module.BookingActionsMenu })));

const prefetch = () => {
  void loadMenus();
};

/** The row's "···" menu with its code deferred; the press mounts it open (see CalendarMenu). */
export function BookingActionsMenu({
  booking,
  onCancel,
}: Omit<BookingActionsMenuProps, 'defaultOpen'>) {
  const [active, setActive] = useState(false);
  const idle = (
    <IconButton
      icon={DotsThreeIcon}
      label={`More actions for ${booking.student.firstName}'s trial`}
      aria-haspopup="menu"
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onClick={() => {
        setActive(true);
      }}
    />
  );
  if (!active) return idle;
  return (
    <Suspense fallback={idle}>
      <Menu booking={booking} onCancel={onCancel} defaultOpen />
    </Suspense>
  );
}
