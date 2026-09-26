import type { Booking } from '@app/contracts';

import { unreachableText } from '../../shared/api/error-copy';
import { Button } from '../../shared/ui/Button';
import { CalendarPlusIcon } from '../../shared/ui/icons';
import { Menu, MenuItem, MenuLinkItem } from '../../shared/ui/Menu';
import { notify } from '../../shared/ui/notify';
import { googleCalendarUrl } from '../booking';

import { downloadIcs } from './ics';

/** "Add to calendar": Google Calendar link or an .ics file for Apple and Outlook (doc 05 §6.1). */
export function CalendarMenu({
  booking,
  primary = false,
}: {
  booking: Booking;
  primary?: boolean;
}) {
  return (
    <Menu
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
