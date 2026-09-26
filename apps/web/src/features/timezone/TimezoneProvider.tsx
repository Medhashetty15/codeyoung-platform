import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { deviceZone, sameZone, type IanaZone } from '@app/time';

import { useMe, useSessionStatus } from '../auth';

import { deviceLocale } from './locale';
import { resolveDisplayZone } from './resolve-zone';
import { TimezoneContext } from './timezone-context';
import { useZoneStore } from './zone-store';

// Only shown after a signed-in parent changes zone; keeps the dialog out of the first load.
const SaveToProfileDialog = lazy(() =>
  import('./SaveToProfileDialog').then((module) => ({ default: module.SaveToProfileDialog })),
);

/**
 * Resolves the display zone (doc 05 §11) and owns changing it: the choice is remembered on this
 * device, mirrored into `?tz` when the page carries one, and a signed-in parent is asked whether
 * the profile (which drives emails) should follow.
 */
export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { chosen, saved, choose } = useZoneStore();
  const status = useSessionStatus();
  const { data: me } = useMe();
  const [device] = useState(deviceZone);
  const [locale] = useState(deviceLocale);
  const [profilePrompt, setProfilePrompt] = useState<IanaZone | null>(null);

  const urlZone = searchParams.get('tz');
  const zone = resolveDisplayZone({
    url: urlZone,
    chosen,
    profile: me?.timezone,
    saved,
    device,
  });

  const setZone = useCallback(
    (next: string) => {
      const resolved = resolveDisplayZone({ chosen: next });
      choose(resolved);
      if (urlZone !== null) {
        setSearchParams(
          (params) => {
            params.set('tz', resolved);
            return params;
          },
          { replace: true },
        );
      }
      if (status === 'authenticated' && me && !sameZone(me.timezone, resolved)) {
        setProfilePrompt(resolved);
      }
    },
    [choose, me, setSearchParams, status, urlZone],
  );

  const value = useMemo(() => ({ zone, device, locale, setZone }), [zone, device, locale, setZone]);

  return (
    <TimezoneContext value={value}>
      {children}
      {profilePrompt && (
        <Suspense fallback={null}>
          <SaveToProfileDialog
            zone={profilePrompt}
            onDone={() => {
              setProfilePrompt(null);
            }}
          />
        </Suspense>
      )}
    </TimezoneContext>
  );
}
