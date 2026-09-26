import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { ClassroomService } from './application/classroom.service';
import { MeetingProvider } from './domain/meeting-provider';
import { ClassroomController } from './http/classroom.controller';
import { ClassroomQuery } from './infra/classroom.query';
import { DummyMeetingProvider } from './infra/dummy-meeting-provider';

/** Meeting links for bookings and the public classroom page lookup (docs/03 §8). */
@Module({
  controllers: [ClassroomController],
  providers: [
    { provide: MeetingProvider, useClass: DummyMeetingProvider },
    repositoryProvider(ClassroomQuery),
    ClassroomService,
  ],
  exports: [MeetingProvider],
})
export class ClassroomModule {}
