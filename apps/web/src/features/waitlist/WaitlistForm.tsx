import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  WaitlistRequestSchema,
  WaitlistResponseSchema,
  type WaitlistRequest,
  type WaitlistResponse,
} from '@app/contracts';

import { isApiError } from '../../shared/api/ApiError';
import { api } from '../../shared/api/client';
import { tooManyAttemptsText, unreachableText } from '../../shared/api/error-copy';
import { useOnline } from '../../shared/hooks/useOnline';
import { Button } from '../../shared/ui/Button';
import { Field, Input } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { useMe } from '../auth';

const FormSchema = WaitlistRequestSchema.pick({ fullName: true, email: true });
type WaitlistValues = z.input<typeof FormSchema>;
type WaitlistOutput = z.output<typeof FormSchema>;

function copyFor(issue: z.core.$ZodRawIssue): string {
  const empty = issue.input === undefined || issue.input === '';
  if (issue.path?.[0] === 'fullName') return 'Enter your full name.';
  return empty ? 'Enter your email address.' : 'Enter an email address like name@example.com.';
}

/** Waitlist sign-up when the whole horizon is full (doc 05 §5.1, FR-W1). Prefilled when logged in. */
export function WaitlistForm({ zone }: { zone: string }) {
  const online = useOnline();
  const { data: me } = useMe();
  const join = useMutation({
    mutationFn: (body: WaitlistRequest) =>
      api<WaitlistResponse>('/waitlist', {
        method: 'POST',
        body,
        schema: import.meta.env.DEV ? WaitlistResponseSchema : undefined,
      }),
  });
  const form = useForm<WaitlistValues, unknown, WaitlistOutput>({
    resolver: zodResolver(FormSchema, { error: copyFor }),
    values: { fullName: me?.fullName ?? '', email: me?.email ?? '' },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors } = form.formState;

  if (join.isSuccess) {
    return (
      <Notice role="status" title="You're on the waitlist">
        We will email {join.variables.email} as soon as a time opens up.
      </Notice>
    );
  }

  const submit = form.handleSubmit((values) => {
    join.mutate({ ...values, timezone: zone as WaitlistRequest['timezone'] });
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-form flex-col gap-5"
    >
      {join.isError && (
        <Notice tone="danger" role="alert">
          {isApiError(join.error, 'RATE_LIMITED')
            ? tooManyAttemptsText(join.error)
            : unreachableText(join.error)}
        </Notice>
      )}
      <Field label="Full name" error={errors.fullName?.message}>
        <Input autoComplete="name" enterKeyHint="next" {...form.register('fullName')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
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
      <Button type="submit" pending={join.isPending} disabled={!online} className="self-start">
        Join the waitlist
      </Button>
    </form>
  );
}
