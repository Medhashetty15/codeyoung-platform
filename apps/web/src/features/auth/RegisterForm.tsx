import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';

import { RegisterRequestSchema, type RegisterRequest } from '@app/contracts';

import { ApiError, isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Field, Input } from '../../shared/ui/Field';
import { FormErrorSummary } from '../../shared/ui/FormErrorSummary';
import { Notice } from '../../shared/ui/Notice';
import { PasswordInput } from '../../shared/ui/PasswordInput';
import { textLinkClassName } from '../../shared/ui/text-link';
import { useDisplayZone, ZoneChip } from '../timezone';

import { WEAK_PASSWORD_COPY, formErrorMap } from './copy';
import { applyServerFieldErrors } from './form-errors';
import { useRegister } from './mutations';
import { withReturnTo } from './return-to';
import { usePasswordPolicy } from './usePasswordPolicy';

const FormSchema = RegisterRequestSchema.omit({ timezone: true });
type RegisterValues = z.input<typeof FormSchema>;
type RegisterOutput = z.output<typeof FormSchema>;

const LABELS = {
  fullName: 'Full name',
  email: 'Email',
  password: 'Password',
  phone: 'Phone',
} as const;
const FIELDS = ['fullName', 'email', 'password', 'phone'] as const;

function passwordReasons(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.code !== 'WEAK_PASSWORD') return undefined;
  const reasons = Array.isArray(error.extras.reasons)
    ? (error.extras.reasons as (keyof typeof WEAK_PASSWORD_COPY)[])
    : [];
  return reasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' ') || WEAK_PASSWORD_COPY.COMMON;
}

/**
 * Create account (doc 05 §9 and §5.2). The time zone is the current display zone, shown with its
 * chip so it can be changed before submitting; the profile zone drives every email.
 */
export function RegisterForm({
  returnTo,
  onSuccess,
}: {
  returnTo?: string | null;
  onSuccess?: () => void;
}) {
  const online = useOnline();
  const register = useRegister();
  const { zone } = useDisplayZone();
  const form = useForm<RegisterValues, unknown, RegisterOutput>({
    resolver: zodResolver(FormSchema, { error: formErrorMap }),
    defaultValues: { fullName: '', email: '', password: '', phone: undefined },
  });
  const { errors, isSubmitted } = form.formState;
  const [password, email] = useWatch({ control: form.control, name: ['password', 'email'] });
  const policy = usePasswordPolicy(password, email);

  const submit = form.handleSubmit(async (values) => {
    const reasons = await policy.violations(values.password, values.email);
    if (reasons.length > 0) {
      form.setError(
        'password',
        { type: 'policy', message: reasons.map((reason) => WEAK_PASSWORD_COPY[reason]).join(' ') },
        { shouldFocus: true },
      );
      return;
    }
    const body: RegisterRequest = { ...values, timezone: zone };
    register.mutate(body, {
      onSuccess: () => onSuccess?.(),
      onError: (error) => {
        if (isApiError(error, 'EMAIL_ALREADY_REGISTERED')) {
          form.setError(
            'email',
            { type: 'server', message: 'An account with this email already exists.' },
            { shouldFocus: true },
          );
        } else if (isApiError(error, 'WEAK_PASSWORD')) {
          form.setError(
            'password',
            { type: 'server', message: passwordReasons(error) },
            { shouldFocus: true },
          );
        } else {
          applyServerFieldErrors(error, form.setError, FIELDS);
        }
      },
    });
  });

  const summary = FIELDS.flatMap((name) => {
    const message = errors[name]?.message;
    return message ? [{ name, label: LABELS[name], message }] : [];
  });
  const error = register.error;
  const formLevel =
    register.isError &&
    !isApiError(error, 'VALIDATION_FAILED') &&
    !isApiError(error, 'WEAK_PASSWORD');

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {isSubmitted && (
        <FormErrorSummary
          errors={summary}
          onSelect={(name) => {
            form.setFocus(name as keyof RegisterValues);
          }}
        />
      )}
      {formLevel && isApiError(error, 'EMAIL_ALREADY_REGISTERED') && (
        <Notice
          tone="danger"
          role="alert"
          action={
            <>
              <Link to={withReturnTo('/login', returnTo)} className={textLinkClassName}>
                Log in
              </Link>
              <Link to={withReturnTo('/forgot-password', returnTo)} className={textLinkClassName}>
                Reset password
              </Link>
            </>
          }
        >
          An account with this email already exists.
        </Notice>
      )}
      {formLevel && !isApiError(error, 'EMAIL_ALREADY_REGISTERED') && (
        <Notice tone="danger" role="alert">
          {isApiError(error, 'RATE_LIMITED') ? tooManyAttemptsText(error) : unreachableText(error)}
        </Notice>
      )}
      <Field label={LABELS.fullName} error={errors.fullName?.message}>
        <Input
          autoComplete="name"
          enterKeyHint="next"
          autoCapitalize="words"
          {...form.register('fullName')}
        />
      </Field>
      <Field
        label={LABELS.email}
        description="We send your booking details here."
        error={errors.email?.message}
      >
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
          autoComplete="new-password"
          enterKeyHint="next"
          rules={policy.rules}
          {...form.register('password', { onBlur: undefined })}
          onFocus={policy.prepare}
        />
      </Field>
      <Field
        label={LABELS.phone}
        optional
        description="Only used if we need to reach you about a class."
        error={errors.phone?.message}
      >
        <Input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="done"
          {...form.register('phone', {
            setValueAs: (value: string) => (value.trim() === '' ? undefined : value),
          })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-ink">Time zone</span>
        <p className="text-small text-ink-muted">Class times and emails use this time zone.</p>
        <div className="mt-1">
          <ZoneChip />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit" pending={register.isPending} disabled={!online} className="w-full">
          Create account
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">
            You are offline. Connect to create your account.
          </p>
        )}
      </div>
    </form>
  );
}
