/** Paths inside the booking flow, where the header does not repeat the "Book a free trial" CTA. */
export function isBookingFlow(pathname: string): boolean {
  return (
    pathname === '/book' ||
    pathname.startsWith('/book/') ||
    /^\/bookings\/[^/]+\/reschedule$/.test(pathname)
  );
}
