import { createContext, use } from 'react';

import type { IanaZone } from '@app/time';

export interface TimezoneContextValue {
  /** The zone every time on screen is shown in. */
  zone: IanaZone;
  /** The device's own zone, for "Your device is set to New York time" checks. */
  device: IanaZone;
  locale: string;
  setZone: (zone: string) => void;
}

export const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function useDisplayZone(): TimezoneContextValue {
  const context = use(TimezoneContext);
  if (!context) throw new Error('useDisplayZone needs <TimezoneProvider>');
  return context;
}
