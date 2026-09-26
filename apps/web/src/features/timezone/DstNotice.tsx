import type { ZoneTransition } from '@app/time';

import { Notice } from '../../shared/ui/Notice';

import { dstNoticeText } from './dst-copy';
import { useDisplayZone } from './timezone-context';

/** Shown when the dates on screen include a clock change in the display zone (doc 05 §11). */
export function DstNotice({ transition }: { transition: ZoneTransition }) {
  const { zone, locale } = useDisplayZone();
  return <Notice>{dstNoticeText(transition, zone, locale)}</Notice>;
}
