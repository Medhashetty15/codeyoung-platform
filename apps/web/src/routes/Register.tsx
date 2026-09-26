import { Link, useSearchParams } from 'react-router';

import { sanitizeReturnTo, withReturnTo } from '../features/auth';
import { RegisterForm } from '../features/auth/forms';
import { textLinkClassName } from '../shared/ui/text-link';

import { AuthLayout } from './AuthLayout';

/** /register?returnTo= (doc 05 §9). */
export function Component() {
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));
  return (
    <AuthLayout
      title="Create account"
      intro="One account for booking, moving and joining your child's trial class."
      footer={
        <>
          Already have an account?{' '}
          <Link to={withReturnTo('/login', returnTo)} className={textLinkClassName}>
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm returnTo={returnTo} />
    </AuthLayout>
  );
}
