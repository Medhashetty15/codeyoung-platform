import { Link } from 'react-router';

import { cn } from '../shared/lib/cn';
import { buttonVariants } from '../shared/ui/button-variants';
import { EmptyState } from '../shared/ui/EmptyState';
import { MagnifyingGlassIcon } from '../shared/ui/icons';
import { PageTitle } from '../shared/ui/PageTitle';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-10">
      <PageTitle>Page not found</PageTitle>
      <EmptyState
        icon={MagnifyingGlassIcon}
        title="We couldn't find that page."
        action={
          <Link to="/" className={cn(buttonVariants({ variant: 'secondary' }))}>
            Go to the home page
          </Link>
        }
      >
        The link may be old or mistyped. Free trial times are one tap away from the home page.
      </EmptyState>
    </div>
  );
}
