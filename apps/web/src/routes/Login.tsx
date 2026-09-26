import { Link, useLocation, useSearchParams } from 'react-router';

import { sanitizeReturnTo, withReturnTo } from '../features/auth';
import { LoginForm } from '../features/auth/forms';
import { Notice } from '../shared/ui/Notice';
import { textLinkClassName } from '../shared/ui/text-link';

import { AuthLayout } from './AuthLayout';

/** /login?returnTo= (doc 05 §9). GuestOnly sends the parent on once the session starts. */
export function Component() {
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));
  const { state } = useLocation() as { state: { notice?: string } | null };

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          New to Codeyoung?{' '}
          <Link to={withReturnTo('/register', returnTo)} className={textLinkClassName}>
            Create account
          </Link>
        </>
      }
    >
      {state?.notice === 'session-expired' && (
        <Notice tone="caution" role="status">
          You were logged out. Log in again to continue.
        </Notice>
      )}
      <LoginForm returnTo={returnTo} />
    </AuthLayout>
  );
}
