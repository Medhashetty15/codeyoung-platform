import { Link } from 'react-router';

import type { Slot } from '@app/contracts';
import { formatDateTime } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { Dialog } from '../../shared/ui/Dialog';

interface SlotTakenDialogProps {
  open: boolean;
  alternatives: Slot[];
  zone: string;
  locale: string;
  allTimesHref: string;
  onPick: (slot: Slot) => void;
  onClose: () => void;
}

/** Lost race for the last mentor (409 NO_MENTOR_AVAILABLE, doc 05 §5.4): one tap to a nearby time. */
export function SlotTakenDialog({
  open,
  alternatives,
  zone,
  locale,
  allTimesHref,
  onPick,
  onClose,
}: SlotTakenDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="That time was just booked"
      description={
        alternatives.length > 0
          ? 'That time was just booked by another family. These times are still free:'
          : 'That time was just booked by another family. Pick another time from the full list.'
      }
      actions={
        <Link
          to={allTimesHref}
          onClick={onClose}
          className={buttonVariants({ variant: 'secondary' })}
        >
          See all times
        </Link>
      }
    >
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-2">
          {alternatives.map((slot) => (
            <Button
              key={slot.start}
              variant="secondary"
              className="w-full justify-start tabular-nums"
              onClick={() => {
                onPick(slot);
              }}
            >
              {formatDateTime(slot.start, zone, locale)}
            </Button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
