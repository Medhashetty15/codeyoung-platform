import { useNavigate } from 'react-router';

import type { BookingSummary } from '@app/contracts';

import { unreachableText } from '../../shared/api/error-copy';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { CalendarPlusIcon, DotsThreeIcon } from '../../shared/ui/icons';
import { Menu, MenuItem, MenuLinkItem } from '../../shared/ui/Menu';
import { notify } from '../../shared/ui/notify';
import { googleCalendarUrl, type CalendarBooking } from '../booking';

import { downloadIcs } from './ics';

/**
 * The booking menus themselves. They load after the page (Base UI Menu is too big for a route's
 * first load); CalendarMenu.tsx and BookingActionsMenu.tsx render a matching trigger meanwhile.
 */

export interface CalendarMenuProps {
  booking: CalendarBooking;
  primary?: boolean;
  defaultOpen?: boolean;
}

/** "Add to calendar": Google Calendar link or an .ics file for Apple and Outlook (doc 05 §6.1). */
export function CalendarMenu({ booking, primary = false, defaultOpen = false }: CalendarMenuProps) {
  return (
    <Menu
      defaultOpen={defaultOpen}
      trigger={
        <Button
          variant={primary ? 'primary' : 'secondary'}
          icon={<CalendarPlusIcon aria-hidden size={20} />}
        >
          Add to calendar
        </Button>
      }
    >
      <MenuLinkItem href={googleCalendarUrl(booking)} target="_blank" rel="noopener noreferrer">
        Google Calendar
      </MenuLinkItem>
      <MenuItem
        onClick={() => {
          downloadIcs(booking).catch((error: unknown) => {
            notify.error("We couldn't download the calendar file", {
              description: unreachableText(error),
            });
          });
        }}
      >
        Apple or Outlook (.ics)
      </MenuItem>
    </Menu>
  );
}

export interface BookingActionsMenuProps {
  booking: BookingSummary;
  onCancel: (booking: BookingSummary) => void;
  defaultOpen?: boolean;
}

/** The row's "···" menu: Reschedule, Cancel (doc 05 §6.2). */
export function BookingActionsMenu({
  booking,
  onCancel,
  defaultOpen = false,
}: BookingActionsMenuProps) {
  const navigate = useNavigate();
  return (
    <Menu
      align="end"
      defaultOpen={defaultOpen}
      trigger={
        <IconButton
          icon={DotsThreeIcon}
          label={`More actions for ${booking.student.firstName}'s trial`}
        />
      }
    >
      <MenuItem
        disabled={!booking.canReschedule}
        onClick={() => void navigate(`/bookings/${booking.id}/reschedule`)}
      >
        Reschedule
      </MenuItem>
      <MenuItem
        tone="danger"
        disabled={!booking.canCancel}
        onClick={() => {
          onCancel(booking);
        }}
      >
        Cancel
      </MenuItem>
    </Menu>
  );
}
