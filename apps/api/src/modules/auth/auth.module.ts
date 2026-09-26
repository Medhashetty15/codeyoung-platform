import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { KeyedRateLimiter } from '../../common/http/keyed-rate-limiter';
import { repositoryProvider } from '../../database/repository-provider';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

import { AccessTokenService } from './application/access-tokens';
import { AuthService } from './application/auth.service';
import { PasswordPolicy } from './application/password-policy';
import { PasswordService } from './application/password.service';
import { AuthController } from './http/auth.controller';
import { JwtAuthGuard } from './http/jwt-auth.guard';
import { PasswordResetTokensRepository } from './infra/password-reset-tokens.repository';
import { RefreshTokensRepository } from './infra/refresh-tokens.repository';
import { SessionsRepository } from './infra/sessions.repository';

@Module({
  imports: [JwtModule.register({}), UsersModule, NotificationsModule],
  controllers: [AuthController],
  providers: [
    repositoryProvider(SessionsRepository),
    repositoryProvider(RefreshTokensRepository),
    repositoryProvider(PasswordResetTokensRepository),
    AccessTokenService,
    AuthService,
    PasswordService,
    PasswordPolicy,
    KeyedRateLimiter,
    JwtAuthGuard,
  ],
  exports: [AccessTokenService, JwtAuthGuard],
})
export class AuthModule {}
