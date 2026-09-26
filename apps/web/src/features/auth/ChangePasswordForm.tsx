import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { PasswordInputSchema, type ChangePasswordRequest } from '@app/contracts';

import { ApiError, isApiError } from '../../shared/api/ApiError';
import { api } from '../../shared/api/client';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Field } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { notify } from '../../shared/ui/notify';
import { PasswordInput } from '../../shared/ui/PasswordInput';

import { WEAK_PASSWORD_COPY, formErrorMap } from './copy';
import { usePasswordPolicy } from './usePasswordPolicy';

const ChangeFormSchema = z.object({
  currentPassword: PasswordInputSchema,
  newPassword: PasswordInputSchema,
});
type ChangeValues = z.input<typeof ChangeFormSchema>;

/**
 * POST /auth/password/change; the server ends every other session (doc 03 §6). Kept here rather
 * than in mutations.ts so this lazy chunk does not share the session module with the entry.
 */
function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      api('/auth/password/change', { method: 'POST', body }),
  });
}

const EMPTY: ChangeValues = { currentPassword: '', newPassword: '' };

/** Password (doc 05 §8): current, then new with the live checklist. Other devices sign out. */
export function ChangePasswordForm({ email }: { email: string }) {
  const online = useOnline();
  const change = useChangePassword();
  const form = useForm<ChangeValues>({
    resolver: zodResolver(ChangeFormSchema, { error: formErrorMap }),
    defaultValues: EMPTY,
  });
  const [newPassword] = useWatch({ control: form.control, name: ['newPassword'] });
  const policy = usePasswordPolicy(newPassword, email);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const reasons = await policy.violations(values.newPassword, email);
    if (reasons.length > 0) {
      form.setError(
        'newPassword',
        { type: 'policy', message: reasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' ') },
        { shouldFocus: true },
      );
      return;
    }
    change.mutate(values, {
      onSuccess: () => {
        form.reset(EMPTY);
        notify.success('Password changed. Other devices have been logged out.');
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        if (error.code === 'INVALID_CREDENTIALS') {
          form.setError(
            'currentPassword',
            { type: 'server', message: "That isn't your current password." },
            { shouldFocus: true },
          );
        }
        if (error.code === 'WEAK_PASSWORD') {
          const serverReasons = Array.isArray(error.extras.reasons)
            ? (error.extras.reasons as (keyof typeof WEAK_PASSWORD_COPY)[])
            : ['COMMON' as const];
          form.setError(
            'newPassword',
            {
              type: 'server',
              message: serverReasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' '),
            },
            { shouldFocus: true },
          );
        }
      },
    });
  });

  const formLevel =
    change.isError &&
    !isApiError(change.error, 'INVALID_CREDENTIALS') &&
    !isApiError(change.error, 'WEAK_PASSWORD');

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {formLevel && (
        <Notice tone="danger" role="alert">
          {isApiError(change.error, 'RATE_LIMITED') ||
          isApiError(change.error, 'ACCOUNT_TEMPORARILY_LOCKED')
            ? tooManyAttemptsText(change.error)
            : unreachableText(change.error)}
        </Notice>
      )}
      {/* Lets password managers pair the new password with this account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Current password" error={errors.currentPassword?.message}>
        <PasswordInput
          autoComplete="current-password"
          enterKeyHint="next"
          {...form.register('currentPassword')}
        />
      </Field>
      <Field label="New password" error={errors.newPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          enterKeyHint="done"
          rules={policy.rules}
          {...form.register('newPassword')}
          onFocus={policy.prepare}
        />
      </Field>
      <div className="flex flex-col items-start gap-2">
        <Button type="submit" pending={change.isPending} disabled={!online}>
          Change password
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">You are offline. Connect to change it.</p>
        )}
      </div>
    </form>
  );
}
