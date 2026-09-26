import { createZodDto } from 'nestjs-zod';

import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from '@app/contracts';

export class RegisterDto extends createZodDto(RegisterRequestSchema) {}
export class LoginDto extends createZodDto(LoginRequestSchema) {}
export class ForgotPasswordDto extends createZodDto(ForgotPasswordRequestSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordRequestSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordRequestSchema) {}
