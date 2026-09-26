import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { MentorScheduleQuery } from './infra/mentor-schedule.query';

/** Mentors and their availability; written by the ops CLI, read through these exports. */
@Module({
  providers: [repositoryProvider(MentorScheduleQuery)],
  exports: [MentorScheduleQuery],
})
export class MentorsModule {}
