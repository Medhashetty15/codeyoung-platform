import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  MeSchema,
  StudentSchema,
  type CreateStudentRequest,
  type Me,
  type Student,
  type UpdateMeRequest,
  type UpdateStudentRequest,
} from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

/** PATCH /me. The profile zone drives emails; the display zone follows it unless one was chosen. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) =>
      api<Me>('/me', {
        method: 'PATCH',
        body,
        schema: import.meta.env.DEV ? MeSchema : undefined,
      }),
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me(), me);
    },
  });
}

export function useSaveStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string | null;
      body: CreateStudentRequest | UpdateStudentRequest;
    }) =>
      api<Student>(id ? `/me/students/${encodeURIComponent(id)}` : '/me/students', {
        method: id ? 'PATCH' : 'POST',
        body,
        schema: import.meta.env.DEV ? StudentSchema : undefined,
      }),
    onSuccess: () => {
      // Bookings show the child's name too.
      for (const key of [qk.students(), qk.bookings(), ['booking']]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
