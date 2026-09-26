/** Paths inside the booking flow, where the header does not repeat the "Book a free trial" CTA. */
export function isBookingFlow(pathname: string): boolean {
  return (
    pathname === '/book' ||
    pathname.startsWith('/book/') ||
    /^\/bookings\/[^/]+\/reschedule$/.test(pathname)
  );
}

/** Login and register pages already are the way in; the header does not repeat "Log in" there. */
export function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register';
}

/** Pages that show the zone chip next to their own times, so the header does not repeat it. */
export function hasOwnZoneChip(pathname: string): boolean {
  return isBookingFlow(pathname) || pathname.startsWith('/class/');
}
