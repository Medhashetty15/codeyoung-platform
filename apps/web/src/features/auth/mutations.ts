import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  AuthResponseSchema,
  type AuthResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from '@app/contracts';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';

import { signedIn } from './session';

function useSignIn() {
  const queryClient = useQueryClient();
  return (response: AuthResponse) => {
    queryClient.setQueryData(qk.me(), response.user);
    signedIn({ accessToken: response.accessToken, expiresIn: response.expiresIn });
  };
}

export function useLogin() {
  const signIn = useSignIn();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      api<AuthResponse>('/auth/login', {
        method: 'POST',
        body,
        auth: false,
        schema: import.meta.env.DEV ? AuthResponseSchema : undefined,
      }),
    onSuccess: signIn,
  });
}

export function useRegister() {
  const signIn = useSignIn();
  return useMutation({
    mutationFn: (body: RegisterRequest) =>
      api<AuthResponse>('/auth/register', {
        method: 'POST',
        body,
        auth: false,
        schema: import.meta.env.DEV ? AuthResponseSchema : undefined,
      }),
    onSuccess: signIn,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordRequest) =>
      api('/auth/password/forgot', { method: 'POST', body, auth: false }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordRequest) =>
      api('/auth/password/reset', { method: 'POST', body, auth: false }),
  });
}
