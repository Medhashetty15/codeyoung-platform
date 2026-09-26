import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

import { useSessionStatus } from './session-store';

// Temporary local schema until @app/contracts ships meSchema (BE-02); swapped before FE-02 review.
const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  timezone: z.string(),
});
export type Me = z.infer<typeof meSchema>;

/** The signed-in parent's profile; disabled until the session is authenticated. */
export function useMe() {
  const status = useSessionStatus();
  return useQuery({
    queryKey: qk.me(),
    queryFn: ({ signal }) => api('/me', { schema: meSchema, signal }),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}
