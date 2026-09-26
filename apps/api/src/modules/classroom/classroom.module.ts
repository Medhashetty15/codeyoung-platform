import { Module } from '@nestjs/common';

import { MeetingProvider } from './domain/meeting-provider';
import { DummyMeetingProvider } from './infra/dummy-meeting-provider';

@Module({
  providers: [{ provide: MeetingProvider, useClass: DummyMeetingProvider }],
  exports: [MeetingProvider],
})
export class ClassroomModule {}
