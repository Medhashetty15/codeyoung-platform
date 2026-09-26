import type { Booking } from '@app/contracts';

import { apiBlob } from '../../shared/api/client';

/**
 * The .ics endpoint needs the bearer token, so a plain link cannot work (doc 05 §6.3): fetch it,
 * then hand the file to the browser.
 */
export async function downloadIcs(booking: Pick<Booking, 'id' | 'reference'>): Promise<void> {
  const blob = await apiBlob(`/bookings/${encodeURIComponent(booking.id)}/calendar.ics`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `codeyoung-trial-${booking.reference}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  // Give Safari a moment to start the download before revoking.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
