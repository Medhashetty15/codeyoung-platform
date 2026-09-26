import { sameZone, zoneParts } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { Notice } from '../../shared/ui/Notice';

interface ZoneChecksProps {
  /** Zone the parent is booking in (the display zone). */
  zone: string;
  deviceZone: string;
  profileZone: string | undefined;
  at: string;
  onUseDeviceZone: () => void;
}

/**
 * Doc 05 §5.3 zone checks: warn when the device disagrees with the chosen zone (one-tap switch),
 * and say that the profile, which drives every email, will follow the chosen zone (A-11).
 */
export function ZoneChecks({
  zone,
  deviceZone,
  profileZone,
  at,
  onUseDeviceZone,
}: ZoneChecksProps) {
  const chosen = zoneParts(zone, at).name;
  const device = zoneParts(deviceZone, at).name;
  return (
    <>
      {!sameZone(zone, deviceZone) && (
        <Notice
          tone="caution"
          action={
            <Button size="compact" variant="secondary" onClick={onUseDeviceZone}>
              Use {device}
            </Button>
          }
        >
          Your device is set to {device}. Are you booking in {chosen}?
        </Notice>
      )}
      {profileZone && !sameZone(zone, profileZone) && (
        <Notice tone="caution">
          Your profile uses {zoneParts(profileZone, at).name}. We will switch it to {chosen} so your
          emails match.
        </Notice>
      )}
    </>
  );
}
