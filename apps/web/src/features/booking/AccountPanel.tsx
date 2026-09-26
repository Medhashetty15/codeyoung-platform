import { useState } from 'react';

import { Tabs } from '../../shared/ui/Tabs';
import { LoginForm, RegisterForm } from '../auth/forms';

/**
 * Inline sign-in on the booking flow (doc 05 §5.2, ADR 0012). Create account is the default tab
 * because most trial parents are new; the chosen slot stays in the URL and the tray throughout.
 */
export function AccountPanel({ returnTo }: { returnTo: string }) {
  const [tab, setTab] = useState<'create' | 'login'>('create');
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h2 text-ink">Your account</h2>
      <p className="text-body text-ink-muted">
        We use it to send the class link and let you move or cancel the trial.
      </p>
      <Tabs
        label="Account"
        value={tab}
        onValueChange={setTab}
        className="mt-3 max-w-form"
        items={[
          { value: 'create', label: 'Create account', panel: <RegisterForm returnTo={returnTo} /> },
          { value: 'login', label: 'Log in', panel: <LoginForm returnTo={returnTo} /> },
        ]}
      />
    </section>
  );
}
