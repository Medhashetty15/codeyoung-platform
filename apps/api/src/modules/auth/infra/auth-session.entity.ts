import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { UserEntity } from '../../users/infra/user.entity';

export type SessionRevokeReason =
  'LOGOUT' | 'PASSWORD_CHANGED' | 'PASSWORD_RESET' | 'REUSE_DETECTED';

/** One login: the family of rotating refresh tokens (`sid` claim of the access JWT). */
@Entity('auth_sessions')
@Check(
  'auth_sessions_revoke_reason_check',
  `"revoke_reason" IN ('LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'REUSE_DETECTED')`,
)
@Index('auth_sessions_user_active', ['userId'], { where: '"revoked_at" IS NULL' })
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => UserEntity, { onDelete: 'CASCADE' })
  userId: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastUsedAt: Date;

  /** Absolute cap (SESSION_MAX_DAYS). */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  revokeReason: SessionRevokeReason | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;
}
