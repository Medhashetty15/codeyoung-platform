import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/infra/user.entity';

@Entity('password_reset_tokens')
@Index('password_reset_tokens_user_id_idx', ['userId'])
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => UserEntity, { onDelete: 'CASCADE' })
  userId: string;

  @Column({ type: 'bytea', unique: true })
  tokenHash: Buffer;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
