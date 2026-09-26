import { useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

import { useTheme } from '../theme/theme';

import { markToasterReady } from './notify';

/**
 * Mounted once at the root. Bottom-right on desktop; on phones Sonner spans the width at the bottom,
 * lifted above the sticky summary bar (which publishes its height as --sticky-bar-offset) and the safe area.
 */
export function Toaster() {
  const theme = useTheme((state) => state.resolved);
  useEffect(markToasterReady, []);
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      offset={24}
      mobileOffset={{
        bottom: 'calc(16px + var(--sticky-bar-offset, 0px) + env(safe-area-inset-bottom, 0px))',
        left: '16px',
        right: '16px',
      }}
      visibleToasts={3}
      containerAriaLabel="Notifications"
      className="z-70"
    />
  );
}
