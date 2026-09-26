import { Link, useLocation } from 'react-router';

import { logout, useSessionStatus } from '../features/auth';
import { cn } from '../shared/lib/cn';
import { buttonVariants } from '../shared/ui/button-variants';
import { Sheet } from '../shared/ui/Sheet';
import { ThemeSwitch } from '../shared/ui/ThemeSwitch';

import { isBookingFlow } from './nav';

const rowClassName =
  'pressable flex h-12 w-full items-center rounded-control px-3 text-body font-medium text-ink hover:bg-sunken active:bg-sunken';

/** The phone menu's content, loaded on first open. */
export function MobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = useSessionStatus();
  const { pathname } = useLocation();
  const close = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Menu">
      <nav aria-label="Main" className="flex flex-col gap-1 pb-2">
        {status === 'authenticated' ? (
          <>
            <Link to="/bookings" onClick={close} className={rowClassName}>
              My bookings
            </Link>
            <Link to="/account" onClick={close} className={rowClassName}>
              Account
            </Link>
          </>
        ) : (
          <Link to="/login" onClick={close} className={rowClassName}>
            Log in
          </Link>
        )}
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-body font-medium text-ink">Theme</span>
          <ThemeSwitch />
        </div>
        {status === 'authenticated' && (
          <button
            type="button"
            className={cn(rowClassName, 'text-left')}
            onClick={() => {
              close();
              void logout();
            }}
          >
            Log out
          </button>
        )}
        {!isBookingFlow(pathname) && (
          <Link to="/book" onClick={close} className={cn(buttonVariants(), 'mt-2 w-full')}>
            Book a free trial
          </Link>
        )}
      </nav>
    </Sheet>
  );
}
