import { useSearchParams } from 'react-router';

import { sanitizeReturnTo } from '../features/auth';
import { ForgotPasswordForm } from '../features/auth/forms';

import { AuthLayout } from './AuthLayout';

/** /forgot-password (doc 05 §9). */
export function Component() {
  const [searchParams] = useSearchParams();
  return (
    <AuthLayout
      title="Reset your password"
      intro="Enter the email you use with Codeyoung and we will send you a link."
    >
      <ForgotPasswordForm returnTo={sanitizeReturnTo(searchParams.get('returnTo'))} />
    </AuthLayout>
  );
}
