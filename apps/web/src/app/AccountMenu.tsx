import { Link } from 'react-router';

import { logout, useMe } from '../features/auth';
import { useTheme, type ThemePreference } from '../shared/theme/theme';
import { Avatar } from '../shared/ui/Avatar';
import { SignOutIcon, UserCircleIcon } from '../shared/ui/icons';
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from '../shared/ui/Menu';

/** Initials avatar opening Account, Theme and Log out (doc 05 §3). */
export function AccountMenu() {
  const { data: me } = useMe();
  const { preference, setPreference } = useTheme();
  const name = me?.fullName ?? 'Your account';

  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Account menu"
          className="pressable flex size-11 items-center justify-center rounded-full hover:bg-sunken"
        >
          <Avatar name={name} size="sm" />
        </button>
      }
    >
      {me && (
        <div className="px-3 pt-2 pb-2.5">
          <p className="text-small font-medium text-ink">{me.fullName}</p>
          <p className="truncate text-small text-ink-muted">{me.email}</p>
        </div>
      )}
      <MenuLinkItem render={<Link to="/account" />}>
        <UserCircleIcon aria-hidden size={20} className="text-ink-muted" />
        Account
      </MenuLinkItem>
      <MenuSeparator />
      <MenuGroup>
        <MenuGroupLabel>Theme</MenuGroupLabel>
        <MenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            setPreference(value as ThemePreference);
          }}
        >
          <MenuRadioItem value="system">System</MenuRadioItem>
          <MenuRadioItem value="light">Light</MenuRadioItem>
          <MenuRadioItem value="dark">Dark</MenuRadioItem>
        </MenuRadioGroup>
      </MenuGroup>
      <MenuSeparator />
      <MenuItem onClick={() => void logout()}>
        <SignOutIcon aria-hidden size={20} className="text-ink-muted" />
        Log out
      </MenuItem>
    </Menu>
  );
}
