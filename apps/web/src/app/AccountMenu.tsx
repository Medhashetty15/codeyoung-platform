import { Link } from 'react-router';

import { logout, useMe } from '../features/auth';
import { useTheme, type ThemePreference } from '../shared/theme/theme';
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

import { AccountMenuButton } from './AccountMenuButton';

/**
 * Initials avatar opening Account, Theme and Log out (doc 05 §3). `defaultOpen` opens it on mount
 * when the avatar was pressed before this code had loaded.
 */
export function AccountMenu({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { data: me } = useMe();
  const { preference, setPreference } = useTheme();

  return (
    <Menu align="end" defaultOpen={defaultOpen} trigger={<AccountMenuButton />}>
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
