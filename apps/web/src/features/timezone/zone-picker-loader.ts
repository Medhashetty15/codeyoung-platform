/** The zone picker chunk (Combobox, zone list). Loaded on first use and prefetched at idle. */
export const loadZonePicker = () => import('./ZonePicker');

/** Fetches the picker chunk ahead of the first tap (idle time, hover, focus, pointer-down). */
export function prefetchZonePicker(): void {
  void loadZonePicker();
}
