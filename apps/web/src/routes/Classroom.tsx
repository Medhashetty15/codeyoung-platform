import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { ClassroomScreen, classroomQuery, clockOffsetMs } from '../features/classroom';
import { isApiError } from '../shared/api/ApiError';
import { unreachableText } from '../shared/api/error-copy';
import { Button } from '../shared/ui/Button';
import { Notice } from '../shared/ui/Notice';
import { PageTitle } from '../shared/ui/PageTitle';
import { Skeleton } from '../shared/ui/Skeleton';

/** /class/:joinToken (doc 05 §7): a focused, centred page; the link itself is the credential. */
export function Component() {
  const { joinToken = '' } = useParams();
  const classroom = useQuery(classroomQuery(joinToken));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 sm:py-16">
      {classroom.isPending && (
        <div
          aria-busy="true"
          aria-label="Loading your class"
          className="flex flex-col items-center gap-4"
        >
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80 max-w-full" />
          <Skeleton className="mt-6 h-20 w-72" />
        </div>
      )}
      {classroom.isError &&
        (isApiError(classroom.error, 'CLASSROOM_NOT_FOUND') ||
        isApiError(classroom.error, 'NOT_FOUND') ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <PageTitle>Class not found</PageTitle>
            <p className="max-w-prose text-body text-ink-muted">
              This class link isn&apos;t valid. Check the link in your email.
            </p>
          </div>
        ) : (
          <Notice
            tone="danger"
            role="alert"
            className="w-full max-w-lg"
            action={
              <Button size="compact" variant="secondary" onClick={() => void classroom.refetch()}>
                Try again
              </Button>
            }
          >
            {unreachableText(classroom.error)}
          </Notice>
        ))}
      {classroom.data && (
        <ClassroomScreen
          view={classroom.data}
          offsetMs={clockOffsetMs(classroom.data.serverTime, classroom.dataUpdatedAt)}
        />
      )}
    </div>
  );
}
