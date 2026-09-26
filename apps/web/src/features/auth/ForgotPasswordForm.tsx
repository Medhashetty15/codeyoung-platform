import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';

import { ForgotPasswordRequestSchema, type ForgotPasswordRequest } from '@app/contracts';

import { isApiError } from '../../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/Button';
import { Field, Input } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { textLinkClassName } from '../../shared/ui/text-link';

import { formErrorMap } from './copy';
import { useForgotPassword } from './mutations';
import { withReturnTo } from './return-to';

type ForgotValues = z.input<typeof ForgotPasswordRequestSchema>;

/**
 * Forgot password (doc 05 §9). The answer is the same whether or not the email has an account,
 * so the page never reveals who is registered.
 */
export function ForgotPasswordForm({ returnTo }: { returnTo?: string | null }) {
  const online = useOnline();
  const forgot = useForgotPassword();
  const form = useForm<ForgotValues, unknown, ForgotPasswordRequest>({
    resolver: zodResolver(ForgotPasswordRequestSchema, { error: formErrorMap }),
    defaultValues: { email: '' },
  });

  if (forgot.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <Notice role="status" title="Check your email">
          If an account exists for that email, we have sent a reset link.
        </Notice>
        <Link to={withReturnTo('/login', returnTo)} className={textLinkClassName}>
          Back to log in
        </Link>
      </div>
    );
  }

  const submit = form.handleSubmit((values) => {
    forgot.mutate(values);
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {forgot.isError && (
        <Notice tone="danger" role="alert">
          {isApiError(forgot.error, 'RATE_LIMITED')
            ? tooManyAttemptsText(forgot.error)
            : unreachableText(forgot.error)}
        </Notice>
      )}
      <Field
        label="Email"
        description="We will send a link to choose a new password."
        error={form.formState.errors.email?.message}
      >
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="send"
          autoCapitalize="none"
          spellCheck={false}
          {...form.register('email')}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <Button type="submit" pending={forgot.isPending} disabled={!online} className="w-full">
          Send reset link
        </Button>
        {!online && (
          <p className="text-small text-ink-muted">You are offline. Connect to send the link.</p>
        )}
      </div>
      <Link
        to={withReturnTo('/login', returnTo)}
        className={cn('self-start text-small', textLinkClassName)}
      >
        Back to log in
      </Link>
    </form>
  );
}
