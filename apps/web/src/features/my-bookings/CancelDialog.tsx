import { useState } from 'react';

import type { BookingSummary, CancelReason } from '@app/contracts';
import { formatDate } from '@app/time';

import { isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Field, NativeSelect } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { notify } from '../../shared/ui/notify';
import { useDisplayZone } from '../timezone';

import { CANCEL_REASONS, notModifiableText } from './booking-view';
import { useCancelBooking } from './queries';

type CancelTarget = Pick<BookingSummary, 'id' | 'start' | 'student'>;

interface CancelDialogProps {
  /** The trial to cancel; the dialog keeps showing the last one while it closes. */
  booking: CancelTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Cancel Leo's trial on Sat 24 Oct?" with an optional reason (doc 05 §6.3). Destructive, so an
 * outside press does not close it and it stays open while the request runs. Keep it mounted:
 * a dialog that mounts already open skips its enter transition.
 */
export function CancelDialog({ booking, open, onOpenChange }: CancelDialogProps) {
  const { zone, locale } = useDisplayZone();
  const cancel = useCancelBooking();
  const [reason, setReason] = useState<CancelReason | ''>('');
  const [shown, setShown] = useState(booking);
  if (booking && booking.id !== shown?.id) {
    setShown(booking);
    setReason('');
    cancel.reset();
  }
  const error = cancel.error;

  const submit = () => {
    if (!shown) return;
    cancel.mutate(
      { id: shown.id, reason: reason || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          notify.success('Trial cancelled');
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (cancel.isPending) return;
        if (!next) cancel.reset();
        onOpenChange(next);
      }}
      dismissible={false}
      title={
        shown
          ? `Cancel ${shown.student.firstName}'s trial on ${formatDate(shown.start, zone, 'short', locale)}?`
          : 'Cancel trial?'
      }
      description="The time will be offered to another family."
      actions={
        <>
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.reset();
              onOpenChange(false);
            }}
          >
            Keep booking
          </Button>
          <Button
            variant="danger"
            pending={cancel.isPending}
            disabled={isApiError(error, 'BOOKING_NOT_MODIFIABLE')}
            onClick={submit}
          >
            Cancel trial
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Reason" optional>
          <NativeSelect
            value={reason}
            onChange={(event) => {
              setReason(event.target.value as CancelReason | '');
            }}
          >
            <option value="">Choose a reason</option>
            {CANCEL_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {error && (
          <Notice tone="danger" role="alert">
            {isApiError(error, 'BOOKING_NOT_MODIFIABLE')
              ? notModifiableText(error.extras.reason, 0)
              : isApiError(error, 'RATE_LIMITED')
                ? tooManyAttemptsText(error)
                : unreachableText(error)}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
