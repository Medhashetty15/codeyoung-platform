import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AuthSessionEntity } from './auth-session.entity';

@Entity('refresh_tokens')
@Index('refresh_tokens_session_id_idx', ['sessionId'])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => AuthSessionEntity, { onDelete: 'CASCADE' })
  sessionId: string;

  /** sha256 of the opaque token; the token itself is never stored. */
  @Column({ type: 'bytea', unique: true })
  tokenHash: Buffer;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Set when the token is rotated. */
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
