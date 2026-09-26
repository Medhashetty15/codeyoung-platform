import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';

import { type AuthResponse, type RefreshResponse } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { Public } from '../../../common/auth/public.decorator';
import { AppError } from '../../../common/errors/app-error';
import { KeyedRateLimiter } from '../../../common/http/keyed-rate-limiter';
import { AppConfig } from '../../../config/app-config';
import { AuthService, type ClientContext, type SessionGrant } from '../application/auth.service';
import { PasswordService } from '../application/password.service';

import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.dto';
import {
  assertRequestedWith,
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per-email limits (docs/03 §6.5); per-IP limits are the @Throttle decorators. */
const LOGIN_PER_EMAIL = { name: 'login-email', limit: 5, ttlMs: MINUTE };
const FORGOT_PER_EMAIL = { name: 'forgot-email', limit: 3, ttlMs: HOUR };

const MAX_USER_AGENT = 512;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly limiter: KeyedRateLimiter,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.grant(response, await this.auth.register(body, clientOf(request)));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    await this.limiter.consume(LOGIN_PER_EMAIL, body.email);
    return this.grant(response, await this.auth.login(body, clientOf(request)));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponse> {
    assertRequestedWith(request);
    try {
      return this.grant(response, await this.auth.refresh(readRefreshCookie(request)));
    } catch (error) {
      // A dead token must not be offered again by the browser.
      if (error instanceof AppError) clearRefreshCookie(response, this.config.auth.cookieSecure);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertRequestedWith(request);
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response, this.config.auth.cookieSecure);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.limiter.consume(FORGOT_PER_EMAIL, body.email);
    await this.passwords.requestReset(body.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.passwords.reset(body.token, body.newPassword);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.passwords.change(
      user.userId,
      user.sessionId,
      body.currentPassword,
      body.newPassword,
    );
  }

  private grant<T>(response: Response, grant: SessionGrant<T>): T {
    setRefreshCookie(
      response,
      grant.refresh.token,
      grant.refresh.maxAgeSeconds,
      this.config.auth.cookieSecure,
    );
    return grant.body;
  }
}

function clientOf(request: Request): ClientContext {
  const userAgent = request.header('user-agent');
  return {
    userAgent: userAgent === undefined ? null : userAgent.slice(0, MAX_USER_AGENT),
    ip: request.ip ?? null,
  };
}
