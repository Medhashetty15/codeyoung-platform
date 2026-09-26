import { describeTransition, formatLocalDate, zoneParts, type ZoneTransition } from '@app/time';

function amount(minutes: number): string {
  if (minutes === 60) return 'one hour';
  if (minutes % 60 === 0) return `${String(minutes / 60)} hours`;
  return `${String(minutes)} minutes`;
}

/** "Clocks in London go back one hour on Sunday 25 October. Times after that are already adjusted." */
export function dstNoticeText(transition: ZoneTransition, zone: string, locale: string): string {
  const { direction, minutes, localDate } = describeTransition(transition, zone);
  const { city } = zoneParts(zone, transition.at);
  const day = formatLocalDate(localDate, 'long', locale);
  return `Clocks in ${city} go ${direction} ${amount(minutes)} on ${day}. Times after that are already adjusted.`;
}
