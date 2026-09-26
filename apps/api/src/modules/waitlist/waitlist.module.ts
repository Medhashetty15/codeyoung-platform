import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { WaitlistService } from './application/waitlist.service';
import { WaitlistController } from './http/waitlist.controller';
import { WaitlistRepository } from './infra/waitlist.repository';

@Module({
  controllers: [WaitlistController],
  providers: [repositoryProvider(WaitlistRepository), WaitlistService],
  exports: [WaitlistRepository],
})
export class WaitlistModule {}
