import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { MentorEntity } from './mentor.entity';

/**
 * Weekly wall-clock window in the mentor's zone (docs/04 §1 rule 3). An end
 * at or before the start means the window crosses midnight.
 */
@Entity('mentor_availability_rules')
@Check('mentor_availability_rules_weekday_check', '"weekday" BETWEEN 1 AND 7')
@Check('mentor_availability_rules_window_check', '"start_local" <> "end_local"')
@Check(
  'mentor_availability_rules_effective_check',
  '"effective_to" IS NULL OR "effective_to" >= "effective_from"',
)
@Index('mentor_availability_rules_mentor_id_idx', ['mentorId'])
export class MentorAvailabilityRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => MentorEntity, { onDelete: 'CASCADE' })
  mentorId: string;

  /** ISO weekday, 1 = Monday. */
  @Column({ type: 'smallint' })
  weekday: number;

  /** `HH:MM:SS` wall-clock time. */
  @Column({ type: 'time' })
  startLocal: string;

  @Column({ type: 'time' })
  endLocal: string;

  /** `YYYY-MM-DD` in the mentor's zone. */
  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;
}
