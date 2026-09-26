import { queryOptions } from '@tanstack/react-query';

import {
  BookingConfigSchema,
  SlotsResponseSchema,
  type BookingConfig,
  type SlotsResponse,
} from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

/**
 * The whole booking horizon for a zone: `from` and `days` are left to the server (its today in
 * `tz`, and the horizon), so a wrong device clock cannot shift the window (PD-13). Fresh for 30 s,
 * refetched on focus and every 60 s while the page is visible (doc 05 §5.1).
 */
export function slotsQuery(tz: string) {
  return queryOptions({
    queryKey: qk.slots(null, 0, tz),
    queryFn: ({ signal }) =>
      api<SlotsResponse>(`/availability/slots?tz=${encodeURIComponent(tz)}`, {
        auth: false,
        signal,
        schema: import.meta.env.DEV ? SlotsResponseSchema : undefined,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Business settings the UI must never hard-code (doc 05 §12.2). Rarely changes. */
export function bookingConfigQuery() {
  return queryOptions({
    queryKey: qk.meta.bookingConfig(),
    queryFn: ({ signal }) =>
      api<BookingConfig>('/meta/booking-config', {
        auth: false,
        signal,
        schema: import.meta.env.DEV ? BookingConfigSchema : undefined,
      }),
    staleTime: 60 * 60_000,
  });
}
