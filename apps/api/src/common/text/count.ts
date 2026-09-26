/** "1 booking", "2 bookings", "1 child", "0 children": counts in operator output. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${String(n)} ${n === 1 ? singular : plural}`;
}
