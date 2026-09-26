import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { ResetPasswordForm } from '../features/auth/forms';
import { Notice } from '../shared/ui/Notice';
import { notify } from '../shared/ui/notify';
import { textLinkClassName } from '../shared/ui/text-link';

import { AuthLayout } from './AuthLayout';

/**
 * /reset-password?token= (doc 05 §9). The token is read once, then removed from the address bar
 * so it does not linger in history, screenshots or a shared link.
 */
export function Component() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => searchParams.get('token'));

  useEffect(() => {
    if (searchParams.has('token')) void navigate('/reset-password', { replace: true });
  }, [navigate, searchParams]);

  return (
    <AuthLayout title="Choose a new password">
      {token ? (
        <ResetPasswordForm
          token={token}
          onDone={() => {
            notify.success('Password updated. Please log in.');
            void navigate('/login', { replace: true });
          }}
        />
      ) : (
        <Notice
          tone="danger"
          title="This link has expired or was already used."
          action={
            <Link to="/forgot-password" className={textLinkClassName}>
              Send a new link
            </Link>
          }
        >
          Open the newest link from your email, or ask for a new one.
        </Notice>
      )}
    </AuthLayout>
  );
}
