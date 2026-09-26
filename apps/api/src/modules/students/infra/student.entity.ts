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

@Entity('students')
@Check('students_age_check', '"age" BETWEEN 4 AND 18')
// Expression index (parent_id, lower(first_name)); created in SQL by the migration.
@Index('students_parent_name', { synchronize: false })
export class StudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @ForeignKey(() => UserEntity, { onDelete: 'CASCADE' })
  parentId: string;

  @Column({ type: 'text' })
  firstName: string;

  @Column({ type: 'smallint' })
  age: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
