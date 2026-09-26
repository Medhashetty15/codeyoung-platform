/** Query key factory (doc 05 §12.1). Keys are arrays so related queries invalidate by prefix. */
export const qk = {
  me: () => ['me'] as const,
  students: () => ['students'] as const,
  slots: (from: string | null, days: number, tz: string) => ['slots', { from, days, tz }] as const,
  bookings: (scope?: 'upcoming' | 'past') =>
    scope ? (['bookings', scope] as const) : (['bookings'] as const),
  booking: (id: string) => ['booking', id] as const,
  classroom: (token: string) => ['classroom', token] as const,
  meta: {
    timezones: () => ['meta', 'timezones'] as const,
    bookingConfig: () => ['meta', 'booking-config'] as const,
  },
};
