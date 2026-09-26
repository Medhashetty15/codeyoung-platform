import { useMutation, useQueryClient } from '@tanstack/react-query';

import { MeSchema, type Me, type UpdateMeRequest } from '@app/contracts';
import { nowInstant, zoneParts, type IanaZone } from '@app/time';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { notify } from '../../shared/ui/notify';

/** "Also save London as your profile time zone?" (doc 05 §11). */
export function SaveToProfileDialog({ zone, onDone }: { zone: IanaZone; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { city } = zoneParts(zone, nowInstant());
  const save = useMutation({
    mutationFn: () =>
      api<Me>('/me', {
        method: 'PATCH',
        body: { timezone: zone } satisfies UpdateMeRequest,
        schema: import.meta.env.DEV ? MeSchema : undefined,
      }),
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me(), me);
      notify.success(`Your profile now uses ${city} time`);
      onDone();
    },
    onError: () => {
      notify.error("We couldn't update your profile. Try again from Account.");
      onDone();
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      title={`Also save ${city} as your profile time zone?`}
      description="Your emails and reminders use your profile time zone."
      actions={
        <>
          <Button variant="secondary" onClick={onDone}>
            Just for now
          </Button>
          <Button
            pending={save.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            Save to profile
          </Button>
        </>
      }
    />
  );
}
