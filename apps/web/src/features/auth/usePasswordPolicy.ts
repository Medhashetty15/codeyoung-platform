import { useCallback, useState } from 'react';

import { passwordPolicyViolations, type WeakPasswordReason } from '@app/contracts';

import type { PasswordRule } from '../../shared/ui/PasswordInput';

import { CHECKLIST_COPY } from './copy';

type IsCommon = (password: string) => boolean;

let listPromise: Promise<IsCommon> | null = null;

/** The 23 kB common-password list loads on first focus of a new-password field, not with the page. */
function loadCommonList(): Promise<IsCommon> {
  listPromise ??= import('@app/contracts/common-passwords').then(
    (module) => module.isCommonPassword,
  );
  return listPromise;
}

/**
 * Live password policy for new-password fields (doc 07 §6): checklist rules for display and
 * `violations()` for submit, which waits for the list so the COMMON rule is never skipped.
 */
export function usePasswordPolicy(password: string, email: string | undefined) {
  const [isCommon, setIsCommon] = useState<IsCommon | null>(null);

  const prepare = useCallback(() => {
    void loadCommonList().then((check) => {
      setIsCommon(() => check);
    });
  }, []);

  const reasons = passwordPolicyViolations(password, email, isCommon ?? (() => false));
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: CHECKLIST_COPY.length,
      met: !reasons.includes('TOO_SHORT') && !reasons.includes('TOO_LONG'),
    },
    // Unknown until the list has loaded; never shown as met on a guess.
    {
      id: 'common',
      label: CHECKLIST_COPY.common,
      met: isCommon !== null && password.length > 0 && !reasons.includes('COMMON'),
    },
    {
      id: 'email',
      label: CHECKLIST_COPY.email,
      met: password.length > 0 && !reasons.includes('CONTAINS_EMAIL'),
    },
  ];

  const violations = useCallback(
    async (value: string, forEmail: string | undefined): Promise<WeakPasswordReason[]> =>
      passwordPolicyViolations(value, forEmail, await loadCommonList()),
    [],
  );

  return { rules, prepare, violations };
}
