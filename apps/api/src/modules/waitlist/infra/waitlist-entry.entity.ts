import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/infra/user.entity';

export type WaitlistStatus = 'OPEN' | 'CONTACTED' | 'CLOSED';

@Entity('waitlist_entries')
@Check('waitlist_entries_status_check', `"status" IN ('OPEN', 'CONTACTED', 'CLOSED')`)
@Index('waitlist_one_open_per_email', ['email'], { unique: true, where: `"status" = 'OPEN'` })
export class WaitlistEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @ForeignKey(() => UserEntity, { onDelete: 'SET NULL' })
  userId: string | null;

  @Column({ type: 'text' })
  fullName: string;

  @Column({ type: 'citext' })
  email: string;

  @Column({ type: 'text' })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  preferredTimes: string | null;

  @Column({ type: 'text', default: 'OPEN' })
  status: WaitlistStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
