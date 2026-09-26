import { type EntityManager, In } from 'typeorm';

import { StudentEntity } from './student.entity';

export interface StudentRecord {
  id: string;
  parentId: string;
  firstName: string;
  age: number;
}

export interface StudentChanges {
  firstName?: string;
  age?: number;
}

const toRecord = (row: StudentEntity): StudentRecord => ({
  id: row.id,
  parentId: row.parentId,
  firstName: row.firstName,
  age: row.age,
});

/** Children, always scoped to their parent: another parent's child simply does not exist. */
export class StudentsRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): StudentsRepository {
    return new StudentsRepository(manager);
  }

  async listByParent(parentId: string): Promise<StudentRecord[]> {
    const rows = await this.manager.find(StudentEntity, {
      where: { parentId },
      // Stable order for the child picker; children added together sort by name.
      order: { createdAt: 'ASC', firstName: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findOwnedMany(
    parentId: string,
    ids: readonly string[],
  ): Promise<Map<string, StudentRecord>> {
    if (ids.length === 0) return new Map();
    const rows = await this.manager.findBy(StudentEntity, { parentId, id: In([...ids]) });
    return new Map(rows.map((row) => [row.id, toRecord(row)]));
  }

  async findOwned(parentId: string, id: string): Promise<StudentRecord | null> {
    const row = await this.manager.findOneBy(StudentEntity, { id, parentId });
    return row && toRecord(row);
  }

  /** @throws QueryFailedError 23505 on `students_parent_name` (same name, any case). */
  async insert(
    parentId: string,
    student: { firstName: string; age: number },
  ): Promise<StudentRecord> {
    const row = await this.manager.save(
      this.manager.create(StudentEntity, { ...student, parentId }),
    );
    return toRecord(row);
  }

  /** Returns false when the child does not belong to the parent. */
  async updateOwned(parentId: string, id: string, changes: StudentChanges): Promise<boolean> {
    const result = await this.manager.update(StudentEntity, { id, parentId }, changes);
    return (result.affected ?? 0) > 0;
  }
}
