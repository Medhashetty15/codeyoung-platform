import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { ProfileService } from './application/profile.service';
import { MeController } from './http/me.controller';
import { PasswordHasher } from './infra/password-hasher';
import { UsersRepository } from './infra/users.repository';

@Module({
  controllers: [MeController],
  providers: [repositoryProvider(UsersRepository), PasswordHasher, ProfileService],
  exports: [UsersRepository, PasswordHasher],
})
export class UsersModule {}
