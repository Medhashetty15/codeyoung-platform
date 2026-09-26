import type { ComponentPropsWithRef } from 'react';

import { useMe } from '../features/auth';
import { Avatar } from '../shared/ui/Avatar';

/**
 * The avatar button that opens the account menu. It lives apart from AccountMenu so the header
 * can show the real control while the menu code is still loading.
 */
export function AccountMenuButton(props: ComponentPropsWithRef<'button'>) {
  const { data: me } = useMe();
  return (
    <button
      type="button"
      aria-label="Account menu"
      aria-haspopup="menu"
      className="pressable flex size-11 items-center justify-center rounded-full hover:bg-sunken"
      {...props}
    >
      <Avatar name={me?.fullName ?? 'Your account'} size="sm" />
    </button>
  );
}
