import {
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeRange,
  isoInstant,
  type DateStyle,
  type InstantLike,
} from '@app/time';

import { useDisplayZone } from './timezone-context';

type LocalTimeProps = {
  at: InstantLike;
  /** Defaults to the display zone. */
  zone?: string;
  className?: string;
} & (
  | { variant: 'time' | 'dateTime' }
  | { variant: 'date'; dateStyle?: DateStyle }
  | { variant: 'range'; end: InstantLike }
);

/** An instant rendered in a zone as `<time datetime="...Z">` (doc 05 §11). */
export function LocalTime(props: LocalTimeProps) {
  const { zone: displayZone, locale } = useDisplayZone();
  const zone = props.zone ?? displayZone;
  let text: string;
  switch (props.variant) {
    case 'time':
      text = formatTime(props.at, zone, locale);
      break;
    case 'dateTime':
      text = formatDateTime(props.at, zone, locale);
      break;
    case 'date':
      text = formatDate(props.at, zone, props.dateStyle ?? 'long', locale);
      break;
    case 'range':
      text = formatTimeRange(props.at, props.end, zone, locale);
      break;
  }
  return (
    <time dateTime={isoInstant(props.at)} className={props.className}>
      {text}
    </time>
  );
}
