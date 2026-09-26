import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import {
  addDays,
  formatTimeRange,
  isoWeekday,
  type LocalDate,
  wallWindowToInstants,
  zoneLabel,
} from '@app/time';

import { type WeeklyWindow } from '../../mentors/infra/mentor-admin.repository';
import { InvalidOptionError } from '../command-errors';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const WeekdaySchema = z.union([
  z.int().min(1).max(7),
  z
    .string()
    .transform((day) => DAYS.indexOf(day.slice(0, 3).toLowerCase() as (typeof DAYS)[number]) + 1)
    .pipe(z.int().min(1, 'use Mon to Sun or 1 to 7')),
]);

const WindowsSchema = z
  .array(
    z
      .object({
        weekday: WeekdaySchema,
        start: z.string().regex(WALL_TIME, 'use HH:MM, 24-hour'),
        end: z.string().regex(WALL_TIME, 'use HH:MM, 24-hour'),
      })
      .refine((window) => window.start !== window.end, 'start and end must differ'),
  )
  .max(50);

/**
 * Reads `[{ "weekday": "Mon" | 1, "start": "19:00", "end": "23:00" }, ...]`:
 * wall times in the mentor's zone; an end before the start crosses midnight.
 */
export async function readWeeklyWindows(path: string): Promise<WeeklyWindow[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new InvalidOptionError(
      `--file: cannot read JSON from ${path} (${(error as Error).message})`,
    );
  }
  const parsed = WindowsSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.map(String).join('.') || '(file)'}: ${issue.message}`,
    );
    throw new InvalidOptionError(`--file: invalid availability\n${issues.join('\n')}`);
  }
  return parsed.data;
}

/** Zones every preview shows next to the mentor's own (docs/03 §10). */
const PREVIEW_ZONES = ['America/New_York', 'Europe/London'];

/** One row per window, for its first date from `from`, in the mentor, NY and London zones. */
export function previewRows(
  windows: readonly WeeklyWindow[],
  mentorZone: string,
  from: LocalDate,
): string[][] {
  return windows.map((window) => {
    const date = firstDateOnWeekday(from, window.weekday);
    const instants = wallWindowToInstants(date, window.start, window.end, mentorZone);
    const day = `${DAY_LABELS[window.weekday - 1] ?? ''} ${date}`;
    if (instants === null) return [day, `${window.start} to ${window.end}`, '(no time that day)'];
    const zones = [mentorZone, ...PREVIEW_ZONES.filter((zone) => zone !== mentorZone)];
    return [
      day,
      ...zones.map(
        (zone) =>
          `${formatTimeRange(instants.start, instants.end, zone, 'en-GB')} ${zoneLabel(zone, instants.start)}`,
      ),
    ];
  });
}

function firstDateOnWeekday(from: LocalDate, weekday: number): LocalDate {
  const offset = (weekday - isoWeekday(from) + 7) % 7;
  return addDays(from, offset);
}
