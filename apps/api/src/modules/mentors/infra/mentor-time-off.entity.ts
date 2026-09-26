import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { MentorEntity } from './mentor.entity';

@Entity('mentor_time_off')
@Check('mentor_time_off_range_check', '"ends_at" > "starts_at"')
@Index('mentor_time_off_mentor_id_starts_at_idx', ['mentorId', 'startsAt'])
export class MentorTimeOffEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => MentorEntity, { onDelete: 'CASCADE' })
  mentorId: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
