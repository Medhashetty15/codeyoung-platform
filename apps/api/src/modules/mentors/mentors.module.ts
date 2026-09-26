import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { MentorScheduleQuery } from './infra/mentor-schedule.query';
import { MentorsRepository } from './infra/mentors.repository';

/** Mentors and their availability; written by the ops CLI, read through these exports. */
@Module({
  providers: [repositoryProvider(MentorScheduleQuery), repositoryProvider(MentorsRepository)],
  exports: [MentorScheduleQuery, MentorsRepository],
})
export class MentorsModule {}
