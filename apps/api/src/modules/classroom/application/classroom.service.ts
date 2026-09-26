import { Injectable } from '@nestjs/common';

import { type ClassroomView, ErrorCode } from '@app/contracts';
import { isoInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { ClassroomQuery } from '../infra/classroom.query';

/** Join tokens are 32 random bytes in base64url (DummyMeetingProvider). */
const JOIN_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The demo classroom behind a personal link (FR-R1, PD-16): the token is the
 * credential. Status is the booking's own; a RESCHEDULED class never reveals
 * the booking that replaced it.
 */
@Injectable()
export class ClassroomService {
  constructor(
    private readonly classrooms: ClassroomQuery,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  async view(token: string): Promise<ClassroomView> {
    const record = JOIN_TOKEN.test(token) ? await this.classrooms.byJoinToken(token) : null;
    if (record === null) throw new AppError(ErrorCode.CLASSROOM_NOT_FOUND);
    return {
      role: record.role,
      status: record.status,
      start: isoInstant(record.startsAt),
      end: isoInstant(record.endsAt),
      childFirstName: record.childFirstName,
      mentorFirstName: record.mentorFirstName,
      parentFirstName: record.parentFirstName,
      timezone: record.timezone as ClassroomView['timezone'],
      serverTime: isoInstant(this.clock.now()),
      classroomOpensMinutesBefore: this.config.booking.classroomOpensMinutesBefore,
    };
  }
}
