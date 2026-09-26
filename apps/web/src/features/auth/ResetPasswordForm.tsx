import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { PasswordInputSchema } from '@app/contracts';

import { ApiError, isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Field } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { PasswordInput } from '../../shared/ui/PasswordInput';
import { textLinkClassName } from '../../shared/ui/text-link';

import { WEAK_PASSWORD_COPY, formErrorMap } from './copy';
import { useResetPassword } from './mutations';
import { usePasswordPolicy } from './usePasswordPolicy';

const ResetFormSchema = z
  .object({ newPassword: PasswordInputSchema, confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: "The passwords don't match.",
  });
type ResetValues = z.input<typeof ResetFormSchema>;

/** Choose a new password from an emailed link (doc 05 §9). */
export function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const online = useOnline();
  const reset = useResetPassword();
  const form = useForm<ResetValues>({
    resolver: zodResolver(ResetFormSchema, {
      error: (issue) =>
        issue.path?.[0] === 'confirmPassword'
          ? 'Enter the same password again.'
          : formErrorMap(issue),
    }),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const [newPassword] = useWatch({ control: form.control, name: ['newPassword'] });
  const policy = usePasswordPolicy(newPassword, undefined);
  const { errors } = form.formState;

  if (isApiError(reset.error, 'RESET_TOKEN_INVALID')) {
    return (
      <Notice
        tone="danger"
        role="alert"
        title="This link has expired or was already used."
        action={
          <Link to="/forgot-password" className={textLinkClassName}>
            Send a new link
          </Link>
        }
      >
        Reset links work once and expire after a short time. Ask for a new one below.
      </Notice>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    const reasons = await policy.violations(values.newPassword, undefined);
    if (reasons.length > 0) {
      form.setError(
        'newPassword',
        { type: 'policy', message: reasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' ') },
        { shouldFocus: true },
      );
      return;
    }
    reset.mutate(
      { token, newPassword: values.newPassword },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'WEAK_PASSWORD') {
            const serverReasons = Array.isArray(error.extras.reasons)
              ? (error.extras.reasons as (keyof typeof WEAK_PASSWORD_COPY)[])
              : ['COMMON' as const];
            form.setError('newPassword', {
              type: 'server',
              message: serverReasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' '),
            });
          }
        },
      },
    );
  });

  const formLevel = reset.isError && !isApiError(reset.error, 'WEAK_PASSWORD');

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {formLevel && (
        <Notice tone="danger" role="alert">
          {isApiError(reset.error, 'RATE_LIMITED')
            ? tooManyAttemptsText(reset.error)
            : unreachableText(reset.error)}
        </Notice>
      )}
      <Field label="New password" error={errors.newPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          enterKeyHint="next"
          rules={policy.rules.filter((rule) => rule.id !== 'email')}
          {...form.register('newPassword')}
          onFocus={policy.prepare}
        />
      </Field>
      <Field label="Confirm new password" error={errors.confirmPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          enterKeyHint="done"
          {...form.register('confirmPassword')}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <Button type="submit" pending={reset.isPending} disabled={!online} className="w-full">
          Save new password
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">You are offline. Connect to save it.</p>
        )}
      </div>
    </form>
  );
}
