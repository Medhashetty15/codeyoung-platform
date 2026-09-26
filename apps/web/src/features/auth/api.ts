import { useQuery } from '@tanstack/react-query';

import { MeSchema, type Me } from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

import { useSessionStatus } from './session-store';

export type { Me };

/** The signed-in parent's profile; disabled until the session is authenticated. */
export function useMe() {
  const status = useSessionStatus();
  return useQuery({
    queryKey: qk.me(),
    queryFn: ({ signal }) =>
      api<Me>('/me', { schema: import.meta.env.DEV ? MeSchema : undefined, signal }),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}
