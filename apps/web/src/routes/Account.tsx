import { lazy, Suspense, type ReactNode } from 'react';

import { ChildrenSection } from '../features/account';
import { useMe } from '../features/auth';
import { unreachableText } from '../shared/api/error-copy';
import { Button } from '../shared/ui/Button';
import { Notice } from '../shared/ui/Notice';
import { PageTitle } from '../shared/ui/PageTitle';
import { Skeleton } from '../shared/ui/Skeleton';

// The forms bring React Hook Form and zod; they load after the page (route budget, doc 05 §12.4).
const ProfileForm = lazy(() =>
  import('../features/account/ProfileForm').then((module) => ({ default: module.ProfileForm })),
);
const ChangePasswordForm = lazy(() =>
  import('../features/auth/ChangePasswordForm').then((module) => ({
    default: module.ChangePasswordForm,
  })),
);

/** Label and control shapes, so the form swaps in without moving the page. */
function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-36" />
    </div>
  );
}

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'children', label: 'Children' },
  { id: 'password', label: 'Password' },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-5 rounded-surface bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-h2 text-ink">
          {title}
        </h2>
        <p className="text-small text-ink-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** /account (doc 05 §8): profile, children and password; a section list on wide screens. */
export function Component() {
  const me = useMe();

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:py-10">
      <PageTitle>Account</PageTitle>
      <div className="mt-8 grid gap-10 lg:grid-cols-[11rem_minmax(0,40rem)]">
        <nav aria-label="Account sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex h-10 items-center rounded-control px-3 text-body text-ink-muted hover:bg-sunken hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {me.isPending && (
            <div aria-busy="true" aria-label="Loading your account" className="flex flex-col gap-6">
              <Skeleton radius="surface" className="h-96 w-full" />
              <Skeleton radius="surface" className="h-48 w-full" />
            </div>
          )}
          {me.isError && (
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button size="compact" variant="secondary" onClick={() => void me.refetch()}>
                  Try again
                </Button>
              }
            >
              {unreachableText(me.error)}
            </Notice>
          )}
          {me.data && (
            <>
              <Section id="profile" title="Profile" description="How we address you and reach you.">
                <Suspense fallback={<FormSkeleton fields={4} />}>
                  <ProfileForm me={me.data} />
                </Suspense>
              </Section>
              <Section
                id="children"
                title="Children"
                description="Children you can book trials for."
              >
                <ChildrenSection />
              </Section>
              <Section
                id="password"
                title="Password"
                description="Changing it logs you out on your other devices."
              >
                <Suspense fallback={<FormSkeleton fields={2} />}>
                  <ChangePasswordForm email={me.data.email} />
                </Suspense>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
