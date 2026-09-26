import { create } from 'zustand';

const SAVED_ZONE_KEY = 'cy-tz';

function readSaved(): string | null {
  try {
    return localStorage.getItem(SAVED_ZONE_KEY);
  } catch {
    return null;
  }
}

interface ZoneStore {
  /** Chosen in this visit; wins over the profile and saved zones. */
  chosen: string | null;
  saved: string | null;
  choose: (zone: string) => void;
}

export const useZoneStore = create<ZoneStore>((set) => ({
  chosen: null,
  saved: readSaved(),
  choose: (zone) => {
    try {
      localStorage.setItem(SAVED_ZONE_KEY, zone);
    } catch {
      // Private mode or blocked storage: the choice lasts for this visit.
    }
    set({ chosen: zone, saved: zone });
  },
}));
