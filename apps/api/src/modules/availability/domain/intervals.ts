/** Half-open interval `[start, end)` in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** Sorted, non-overlapping union; touching intervals are joined. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** `from` minus every interval of `holes` (both may overlap themselves). */
export function subtractIntervals(
  from: readonly Interval[],
  holes: readonly Interval[],
): Interval[] {
  const cuts = mergeIntervals(holes);
  const result: Interval[] = [];
  for (const interval of mergeIntervals(from)) {
    let cursor = interval.start;
    for (const cut of cuts) {
      if (cut.end <= cursor || cut.start >= interval.end) continue;
      if (cut.start > cursor) result.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
      if (cursor >= interval.end) break;
    }
    if (cursor < interval.end) result.push({ start: cursor, end: interval.end });
  }
  return result;
}
