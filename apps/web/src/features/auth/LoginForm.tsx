import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';

import { LoginRequestSchema, type LoginRequest } from '@app/contracts';

import { isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/Button';
import { Field, Input } from '../../shared/ui/Field';
import { FormErrorSummary } from '../../shared/ui/FormErrorSummary';
import { Notice } from '../../shared/ui/Notice';
import { PasswordInput } from '../../shared/ui/PasswordInput';
import { textLinkClassName } from '../../shared/ui/text-link';

import { formErrorMap } from './copy';
import { applyServerFieldErrors } from './form-errors';
import { useLogin } from './mutations';
import { withReturnTo } from './return-to';

type LoginValues = z.input<typeof LoginRequestSchema>;

const LABELS = { email: 'Email', password: 'Password' } as const;

function serverMessage(error: unknown): string {
  if (isApiError(error, 'INVALID_CREDENTIALS')) return "That email and password don't match.";
  if (isApiError(error, 'ACCOUNT_TEMPORARILY_LOCKED') || isApiError(error, 'RATE_LIMITED')) {
    return tooManyAttemptsText(error);
  }
  return unreachableText(error);
}

/** Log in (doc 05 §9). Used by /login and by the booking flow's Account panel. */
export function LoginForm({
  returnTo,
  onSuccess,
}: {
  returnTo?: string | null;
  onSuccess?: () => void;
}) {
  const online = useOnline();
  const login = useLogin();
  const form = useForm<LoginValues, unknown, LoginRequest>({
    resolver: zodResolver(LoginRequestSchema, { error: formErrorMap }),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitted } = form.formState;

  const submit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => onSuccess?.(),
      onError: (error) => {
        applyServerFieldErrors(error, form.setError, ['email', 'password']);
      },
    });
  });

  const summary = (Object.keys(LABELS) as (keyof typeof LABELS)[]).flatMap((name) => {
    const message = errors[name]?.message;
    return message ? [{ name, label: LABELS[name], message }] : [];
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {isSubmitted && (
        <FormErrorSummary
          errors={summary}
          onSelect={(name) => {
            form.setFocus(name as keyof LoginValues);
          }}
        />
      )}
      {login.isError && !isApiError(login.error, 'VALIDATION_FAILED') && (
        <Notice tone="danger" role="alert">
          {serverMessage(login.error)}
        </Notice>
      )}
      <Field label={LABELS.email} error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          autoCapitalize="none"
          spellCheck={false}
          {...form.register('email')}
        />
      </Field>
      <Field label={LABELS.password} error={errors.password?.message}>
        <PasswordInput
          autoComplete="current-password"
          enterKeyHint="done"
          {...form.register('password')}
        />
      </Field>
      <Link
        to={withReturnTo('/forgot-password', returnTo)}
        className={cn('self-start text-small', textLinkClassName)}
      >
        Forgot password?
      </Link>
      <div className="flex flex-col gap-2">
        <Button type="submit" pending={login.isPending} disabled={!online} className="w-full">
          Log in
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">You are offline. Connect to log in.</p>
        )}
      </div>
    </form>
  );
}
