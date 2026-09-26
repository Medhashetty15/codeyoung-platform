import { queryOptions } from '@tanstack/react-query';

import { ClassroomViewSchema, type ClassroomView } from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

/** GET /classroom/:joinToken, public (the link is the credential). Re-checked every minute. */
export function classroomQuery(token: string) {
  return queryOptions({
    queryKey: qk.classroom(token),
    queryFn: ({ signal }) =>
      api<ClassroomView>(`/classroom/${encodeURIComponent(token)}`, {
        auth: false,
        signal,
        schema: import.meta.env.DEV ? ClassroomViewSchema : undefined,
      }),
    staleTime: 0,
    refetchInterval: 60_000,
  });
}
