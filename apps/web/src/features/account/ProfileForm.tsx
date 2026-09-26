import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FullNameSchema, PhoneSchema, type Me, type UpdateMeRequest } from '@app/contracts';
import { canonicalZone } from '@app/time';

import { isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { config } from '../../shared/config';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Field, Input } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { notify } from '../../shared/ui/notify';
import { textLinkClassName } from '../../shared/ui/text-link';
import { formErrorMap } from '../auth/copy';
import { applyServerFieldErrors } from '../auth/form-errors';
import { ZoneField } from '../timezone/ZoneField';

import { useUpdateMe } from './queries';

const ProfileSchema = z.object({
  fullName: FullNameSchema,
  // Empty clears the phone; a union would hide the field path from our error copy.
  phone: z.string().refine((value) => !value.trim() || PhoneSchema.safeParse(value).success),
  timezone: z.string(),
});
type ProfileValues = z.input<typeof ProfileSchema>;

const FIELDS = ['fullName', 'phone', 'timezone'] as const;

/** Only what changed, so a save never rewrites fields the parent did not touch. */
function changes(values: ProfileValues, me: Me): UpdateMeRequest {
  const body: UpdateMeRequest = {};
  const fullName = values.fullName.trim();
  const phone = values.phone.trim() || null;
  if (fullName !== me.fullName) body.fullName = fullName;
  if (phone !== me.phone) body.phone = phone;
  if (values.timezone !== me.timezone) body.timezone = canonicalZone(values.timezone);
  return body;
}

/** Profile (doc 05 §8): name, phone and the time zone emails use. Email is read-only. */
export function ProfileForm({ me }: { me: Me }) {
  const online = useOnline();
  const update = useUpdateMe();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema, { error: formErrorMap }),
    defaultValues: { fullName: me.fullName, phone: me.phone ?? '', timezone: me.timezone },
  });
  const [timezone] = useWatch({ control: form.control, name: ['timezone'] });
  const { errors, isDirty } = form.formState;
  const zoneHelpId = 'profile-zone-help';

  const submit = form.handleSubmit((values) => {
    const body = changes(values, me);
    if (Object.keys(body).length === 0) {
      form.reset(values);
      return;
    }
    update.mutate(body, {
      onSuccess: (saved) => {
        form.reset({
          fullName: saved.fullName,
          phone: saved.phone ?? '',
          timezone: saved.timezone,
        });
        notify.success('Profile saved');
      },
      onError: (error) => {
        applyServerFieldErrors(error, form.setError, FIELDS);
      },
    });
  });

  const formLevel =
    update.isError &&
    !isApiError(update.error, 'VALIDATION_FAILED') &&
    !isApiError(update.error, 'INVALID_TIMEZONE');

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {formLevel && (
        <Notice tone="danger" role="alert">
          {isApiError(update.error, 'RATE_LIMITED')
            ? tooManyAttemptsText(update.error)
            : unreachableText(update.error)}
        </Notice>
      )}
      <Field label="Full name" error={errors.fullName?.message}>
        <Input autoComplete="name" enterKeyHint="next" {...form.register('fullName')} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-ink">Email</span>
        <p className="text-body text-ink">{me.email}</p>
        <p className="text-small text-ink-muted">
          To change it, write to{' '}
          <a href={`mailto:${config.supportEmail}`} className={textLinkClassName}>
            {config.supportEmail}
          </a>
          .
        </p>
      </div>
      <Field
        label="Phone"
        optional
        description="Only used if we need to reach you about a class."
        error={errors.phone?.message}
      >
        <Input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="done"
          {...form.register('phone')}
        />
      </Field>
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-small font-medium text-ink">Time zone</span>
        <p id={zoneHelpId} className="text-small text-ink-muted">
          Emails and class times use this time zone.
        </p>
        <ZoneField
          value={timezone}
          aria-describedby={zoneHelpId}
          onChange={(zone) => {
            form.setValue('timezone', zone, { shouldDirty: true });
          }}
        />
        {isApiError(update.error, 'INVALID_TIMEZONE') && (
          <p className="text-small text-danger">Choose a time zone from the list.</p>
        )}
      </div>
      <div className="flex flex-col items-start gap-2">
        <Button type="submit" pending={update.isPending} disabled={!online || !isDirty}>
          Save changes
        </Button>
        {!online && <p className="text-small text-ink-muted">You are offline. Connect to save.</p>}
      </div>
    </form>
  );
}
