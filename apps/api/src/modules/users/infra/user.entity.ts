import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'PARENT';

@Entity('users')
@Check('users_role_check', `"role" IN ('PARENT')`)
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  /** argon2id PHC string. */
  @Column({ type: 'text' })
  passwordHash: string;

  @Column({ type: 'text' })
  fullName: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  /** Canonical IANA zone (ADR 0017). */
  @Column({ type: 'text' })
  timezone: string;

  @Column({ type: 'text', default: 'PARENT' })
  role: UserRole;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  /** First failure of the current lockout window (LOGIN_LOCK_MINUTES long). */
  @Column({ type: 'timestamptz', nullable: true })
  failedLoginWindowStartedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  passwordChangedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
