import { isRouteErrorResponse, useRouteError } from 'react-router';

import { ApiError } from '../shared/api/ApiError';
import { Button } from '../shared/ui/Button';
import { Notice } from '../shared/ui/Notice';
import { PageTitle } from '../shared/ui/PageTitle';

import { NotFound } from './NotFound';

/** A lazy chunk from an older deploy is gone; a reload fetches the current build. */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed/i.test(error.message)
  );
}

/** Route-level error boundary: what happened, a way forward, and a reference (doc 05 §12.5). */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  const reference = error instanceof ApiError ? error.reference : undefined;
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-10">
      <PageTitle>This page failed to load</PageTitle>
      <Notice
        tone="danger"
        action={
          <Button
            variant="secondary"
            size="compact"
            onClick={() => {
              window.location.reload();
            }}
          >
            Try again
          </Button>
        }
      >
        {isChunkLoadError(error)
          ? 'A newer version of the site is available. Reload the page to continue.'
          : 'Something on our side stopped this page from loading. Reload the page, and if it keeps happening, contact us.'}
        {reference && <> Reference: {reference}</>}
      </Notice>
    </div>
  );
}
