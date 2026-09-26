import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BookingSchema,
  StudentListSchema,
  type Booking,
  type CreateBookingRequest,
  type Student,
} from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';
import { useSessionStatus } from '../auth';

export function useStudents() {
  const status = useSessionStatus();
  return useQuery({
    queryKey: qk.students(),
    queryFn: ({ signal }) =>
      api<Student[]>('/me/students', {
        signal,
        schema: import.meta.env.DEV ? StudentListSchema : undefined,
      }),
    enabled: status === 'authenticated',
  });
}

/** GET /bookings/:id; `null` waits (e.g. for the id of the booking a trial moved to). */
export function useBooking(id: string | null) {
  return useQuery({
    queryKey: qk.booking(id ?? ''),
    queryFn: ({ signal }) =>
      api<Booking>(`/bookings/${encodeURIComponent(id ?? '')}`, {
        signal,
        schema: import.meta.env.DEV ? BookingSchema : undefined,
      }),
    enabled: id !== null,
  });
}

export interface CreateBookingVariables {
  body: CreateBookingRequest;
  idempotencyKey: string;
}

/** POST /bookings; on success everything that depends on availability or bookings refreshes. */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: CreateBookingVariables) =>
      api<Booking>('/bookings', {
        method: 'POST',
        body,
        idempotencyKey,
        schema: import.meta.env.DEV ? BookingSchema : undefined,
      }),
    onSuccess: (booking) => {
      queryClient.setQueryData(qk.booking(booking.id), booking);
      for (const key of [['slots'], ['bookings'], qk.students(), qk.me()]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
