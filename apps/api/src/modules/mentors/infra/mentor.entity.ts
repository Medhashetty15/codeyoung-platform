import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mentors')
@Check('mentors_max_trials_per_day_check', '"max_trials_per_day" > 0')
export class MentorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  fullName: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  /** Canonical IANA zone the mentor's availability is written in. */
  @Column({ type: 'text' })
  timezone: string;

  @Column({ type: 'smallint', default: 2 })
  maxTrialsPerDay: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Round-robin tie-breaker for assignment (ADR 0011). */
  @Column({ type: 'timestamptz', nullable: true })
  lastAssignedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
