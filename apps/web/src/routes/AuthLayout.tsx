import type { ReactNode } from 'react';

import { parentAndChildPhoto } from '../assets/photos';
import { PageTitle } from '../shared/ui/PageTitle';
import { Photo } from '../shared/ui/Photo';

interface AuthLayoutProps {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  /** Links under the form, such as "Already have an account? Log in". */
  footer?: ReactNode;
}

/** Doc 05 §9: form column (max 400px) left, photo asset #2 right on desktop; form only on phones. */
export function AuthLayout({ title, intro, children, footer }: AuthLayoutProps) {
  return (
    <div className="mx-auto grid max-w-content gap-12 px-4 py-6 sm:py-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-20 lg:py-14">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <PageTitle>{title}</PageTitle>
          {Boolean(intro) && <p className="text-body text-ink-muted">{intro}</p>}
        </div>
        {children}
        {Boolean(footer) && (
          <div className="border-t border-line pt-5 text-small text-ink-muted">{footer}</div>
        )}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <Photo
            photo={parentAndChildPhoto}
            sizes="(min-width: 1120px) 560px, 45vw"
            className="rounded-surface"
          />
        </div>
      </div>
    </div>
  );
}
