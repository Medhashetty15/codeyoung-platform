import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'DEAD';

/** Transactional outbox row, written in the same transaction as the change (ADR 0005). */
@Entity('outbox_messages')
@Check('outbox_messages_status_check', `"status" IN ('PENDING', 'PROCESSING', 'DONE', 'DEAD')`)
@Index('outbox_due', ['runAfter'], { where: `"status" = 'PENDING'` })
export class OutboxMessageEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'text', default: 'PENDING' })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  runAfter: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
