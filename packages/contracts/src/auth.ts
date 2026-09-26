import { z } from 'zod';

import { MeSchema } from './me.js';
import { EmailSchema, FullNameSchema, IanaZoneSchema, PhoneSchema } from './primitives.js';

/**
 * Passwords are only length-capped here; the policy (docs/03 §6.3) is applied
 * by the API and reported as WEAK_PASSWORD with `reasons`. The cap keeps
 * hashing cost bounded even for bodies that skip the policy check.
 */
export const PasswordInputSchema = z.string().min(1).max(1024);

export const RegisterRequestSchema = z.object({
  fullName: FullNameSchema,
  email: EmailSchema,
  password: PasswordInputSchema,
  phone: PhoneSchema.optional(),
  timezone: IanaZoneSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterRequestInput = z.input<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordInputSchema,
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Returned by register and login; the refresh token travels only as the httpOnly cookie. */
export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  /** Access token lifetime in seconds (900). */
  expiresIn: z.int().positive(),
  user: MeSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshResponseSchema = AuthResponseSchema.pick({
  accessToken: true,
  expiresIn: true,
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: PasswordInputSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: PasswordInputSchema,
  newPassword: PasswordInputSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
