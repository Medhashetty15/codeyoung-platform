import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';
import { BookingsModule } from '../bookings/bookings.module';

import { StudentsService } from './application/students.service';
import { StudentsController } from './http/students.controller';
import { StudentsRepository } from './infra/students.repository';

@Module({
  imports: [BookingsModule],
  controllers: [StudentsController],
  providers: [repositoryProvider(StudentsRepository), StudentsService],
  exports: [StudentsRepository],
})
export class StudentsModule {}
