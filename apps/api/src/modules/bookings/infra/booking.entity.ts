import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { type BookingStatus } from '@app/contracts';

import { MentorEntity } from '../../mentors/infra/mentor.entity';
import { StudentEntity } from '../../students/infra/student.entity';
import { UserEntity } from '../../users/infra/user.entity';

export type CancelledBy = 'PARENT' | 'OPS';

/**
 * A trial class. Overlaps per mentor (including the buffer) are impossible by
 * the exclusion constraint; one upcoming trial per student by a partial unique
 * index (docs/03 §3.4, ADR 0004).
 */
@Entity('bookings')
@Check(
  'bookings_status_check',
  `"status" IN ('CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED')`,
)
@Check('bookings_cancelled_by_check', `"cancelled_by" IN ('PARENT', 'OPS')`)
@Check('bookings_time_order_check', '"ends_at" > "starts_at" AND "blocked_until" >= "ends_at"')
@Exclusion(
  'bookings_no_mentor_overlap',
  `USING gist ("mentor_id" WITH =, tstzrange("starts_at", "blocked_until", '[)') WITH &&) WHERE ("status" = 'CONFIRMED')`,
)
@Unique('bookings_parent_id_idempotency_key_key', ['parentId', 'idempotencyKey'])
@Index('bookings_one_upcoming_per_student', ['studentId'], {
  unique: true,
  where: `"status" = 'CONFIRMED'`,
})
@Index('bookings_mentor_day', ['mentorId', 'mentorLocalDate'], { where: `"status" = 'CONFIRMED'` })
@Index('bookings_confirmed_start', ['startsAt'], { where: `"status" = 'CONFIRMED'` })
// (parent_id, starts_at DESC): sort order is not expressible here; created in SQL by the migration.
@Index('bookings_parent_start', { synchronize: false })
export class BookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human reference, `CY-` plus 6 Crockford base32 characters. */
  @Column({ type: 'text', unique: true })
  reference: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => UserEntity)
  parentId: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => StudentEntity)
  studentId: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => MentorEntity)
  mentorId: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  /** `ends_at` plus the mentor buffer; the exclusion constraint uses it. */
  @Column({ type: 'timestamptz' })
  blockedUntil: Date;

  /** Mentor-local date of the start: the daily cap bucket (A-1). */
  @Column({ type: 'date' })
  mentorLocalDate: string;

  /** Zones at booking time, kept for audit. */
  @Column({ type: 'text' })
  parentTimezone: string;

  @Column({ type: 'text' })
  mentorTimezone: string;

  @Column({ type: 'text', default: 'CONFIRMED' })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  cancelledBy: CancelledBy | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  @ForeignKey(() => BookingEntity)
  rescheduledFromId: string | null;

  @Column({ type: 'text', unique: true })
  parentJoinToken: string;

  @Column({ type: 'text', unique: true })
  mentorJoinToken: string;

  @Column({ type: 'text' })
  meetingUrl: string;

  /** Bumped on every change so calendar clients update the event. */
  @Column({ type: 'int', default: 0 })
  icsSequence: number;

  @Column({ type: 'text', nullable: true })
  idempotencyKey: string | null;

  /** sha256 of the canonical request body, to detect key reuse with another payload. */
  @Column({ type: 'text', nullable: true })
  requestFingerprint: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
