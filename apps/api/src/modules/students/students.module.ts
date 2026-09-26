import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';
import { BookingsReadModule } from '../bookings/bookings-read.module';

import { StudentsService } from './application/students.service';
import { StudentsController } from './http/students.controller';
import { StudentsRepository } from './infra/students.repository';

@Module({
  imports: [BookingsReadModule],
  controllers: [StudentsController],
  providers: [repositoryProvider(StudentsRepository), StudentsService],
  exports: [StudentsRepository],
})
export class StudentsModule {}
