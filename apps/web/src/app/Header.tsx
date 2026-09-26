import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { useSessionStatus } from '../features/auth';
import { cn } from '../shared/lib/cn';
import { buttonVariants } from '../shared/ui/button-variants';

import { AccountMenuButton } from './AccountMenuButton';
import { MobileNav } from './MobileNav';
import { hasOwnZoneChip, isAuthPage, isBookingFlow } from './nav';
import { loadAccountMenu } from './prefetch';
import { Wordmark } from './Wordmark';

// Only signed-in parents see the account menu; its Menu primitives load with it.
const AccountMenu = lazy(() =>
  loadAccountMenu().then((module) => ({ default: module.AccountMenu })),
);

/**
 * Sticky 64px header (doc 05 §3): translucent with blur, solid under reduced transparency. The
 * hairline and shadow fade in only once content scrolls beneath it (motion row 15), driven by
 * `scrolled`, which AppShell derives from an IntersectionObserver sentinel.
 */
export function Header({ scrolled, zoneChip }: { scrolled: boolean; zoneChip?: ReactNode }) {
  const status = useSessionStatus();
  const { pathname } = useLocation();
  const showBookCta = !isBookingFlow(pathname);
  const [accountActive, setAccountActive] = useState(false);
  const accountButton = (
    <AccountMenuButton
      onPointerEnter={() => void loadAccountMenu()}
      onFocus={() => void loadAccountMenu()}
      onClick={() => {
        setAccountActive(true);
      }}
    />
  );

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 bg-(--header-glass) backdrop-blur-md reduced-transparency:bg-canvas reduced-transparency:backdrop-blur-none',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-0 bottom-0 h-px bg-line shadow-float transition-opacity duration-(--dur-color) ease-out',
          scrolled ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="relative mx-auto flex h-16 max-w-content items-center gap-3 px-4">
        <Wordmark />
        <div className="ml-auto flex items-center gap-2">
          {/* Booking and class pages show the chip next to the times instead. */}
          {!hasOwnZoneChip(pathname) && zoneChip}
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {status === 'authenticated' && (
              <Link to="/bookings" className={buttonVariants({ variant: 'ghost' })}>
                My bookings
              </Link>
            )}
            {status === 'anonymous' && !isAuthPage(pathname) && (
              <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
                Log in
              </Link>
            )}
            {status === 'authenticated' &&
              // The avatar button stays until pressed; the press mounts the menu already open, so
              // no control is swapped under the pointer mid-click (the lost first click).
              (accountActive ? (
                <Suspense fallback={accountButton}>
                  <AccountMenu defaultOpen />
                </Suspense>
              ) : (
                accountButton
              ))}
            {showBookCta && (
              <Link to="/book" className={cn(buttonVariants(), 'ml-1')}>
                Book a free trial
              </Link>
            )}
          </nav>
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
