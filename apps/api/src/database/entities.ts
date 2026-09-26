import { AuthSessionEntity } from '../modules/auth/infra/auth-session.entity';
import { PasswordResetTokenEntity } from '../modules/auth/infra/password-reset-token.entity';
import { RefreshTokenEntity } from '../modules/auth/infra/refresh-token.entity';
import { BookingEventEntity } from '../modules/bookings/infra/booking-event.entity';
import { BookingEntity } from '../modules/bookings/infra/booking.entity';
import { MentorAvailabilityRuleEntity } from '../modules/mentors/infra/mentor-availability-rule.entity';
import { MentorTimeOffEntity } from '../modules/mentors/infra/mentor-time-off.entity';
import { MentorEntity } from '../modules/mentors/infra/mentor.entity';
import { EmailDeliveryEntity } from '../modules/notifications/infra/email-delivery.entity';
import { OutboxMessageEntity } from '../modules/notifications/infra/outbox-message.entity';
import { StudentEntity } from '../modules/students/infra/student.entity';
import { UserEntity } from '../modules/users/infra/user.entity';
import { WaitlistEntryEntity } from '../modules/waitlist/infra/waitlist-entry.entity';

/** Every mapped table (docs/03 §3). Listed explicitly: no path globs. */
export const ENTITIES = [
  UserEntity,
  AuthSessionEntity,
  RefreshTokenEntity,
  PasswordResetTokenEntity,
  StudentEntity,
  MentorEntity,
  MentorAvailabilityRuleEntity,
  MentorTimeOffEntity,
  BookingEntity,
  BookingEventEntity,
  OutboxMessageEntity,
  EmailDeliveryEntity,
  WaitlistEntryEntity,
];
