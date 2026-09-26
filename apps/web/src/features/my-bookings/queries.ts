import {
  infiniteQueryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  BookingListResponseSchema,
  BookingSchema,
  type Booking,
  type BookingListResponse,
  type CancelReason,
  type RescheduleBookingRequest,
} from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

export type BookingScope = 'upcoming' | 'past';

/** GET /bookings, one page per "Show more" (keyset cursor, doc 03 §9). */
export function bookingsQuery(scope: BookingScope) {
  return infiniteQueryOptions({
    queryKey: qk.bookings(scope),
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams({ scope });
      if (pageParam) params.set('cursor', pageParam);
      return api<BookingListResponse>(`/bookings?${params.toString()}`, {
        signal,
        schema: import.meta.env.DEV ? BookingListResponseSchema : undefined,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** A cancel or a move changes the lists, the free times and each child's "has a trial" flag. */
function refreshAfterChange(queryClient: QueryClient, ...changed: Booking[]): void {
  for (const booking of changed) queryClient.setQueryData(qk.booking(booking.id), booking);
  for (const key of [qk.bookings(), ['slots'], qk.students()]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: CancelReason | undefined }) =>
      api<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: reason ? { reason } : {},
        schema: import.meta.env.DEV ? BookingSchema : undefined,
      }),
    onSuccess: (booking) => {
      refreshAfterChange(queryClient, booking);
    },
  });
}

export interface RescheduleVariables {
  id: string;
  body: RescheduleBookingRequest;
  idempotencyKey: string;
}

export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }: RescheduleVariables) =>
      api<Booking>(`/bookings/${encodeURIComponent(id)}/reschedule`, {
        method: 'POST',
        body,
        idempotencyKey,
        schema: import.meta.env.DEV ? BookingSchema : undefined,
      }),
    onSuccess: (moved, { id }) => {
      refreshAfterChange(queryClient, moved);
      // The old booking is now RESCHEDULED and points at the new one.
      void queryClient.invalidateQueries({ queryKey: qk.booking(id) });
    },
  });
}
