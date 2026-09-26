import { Injectable } from '@nestjs/common';

import {
  type CreateStudentRequest,
  ErrorCode,
  type Student,
  type UpdateStudentRequest,
} from '@app/contracts';
import { isoInstant } from '@app/time';

import { AppError } from '../../../common/errors/app-error';
import { isUniqueViolation } from '../../../database/pg-errors';
import {
  type UpcomingTrial,
  UpcomingTrialsQuery,
} from '../../bookings/infra/upcoming-trials.query';
import { type StudentRecord, StudentsRepository } from '../infra/students.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toStudent(record: StudentRecord, trial: UpcomingTrial | undefined): Student {
  return {
    id: record.id,
    firstName: record.firstName,
    age: record.age,
    upcomingTrial:
      trial === undefined ? null : { bookingId: trial.bookingId, start: isoInstant(trial.start) },
  };
}

function notFound(): AppError {
  return new AppError(ErrorCode.STUDENT_NOT_FOUND);
}

function nameTaken(firstName: string): AppError {
  return new AppError(ErrorCode.STUDENT_NAME_TAKEN, {
    detail: `You already added a child called ${firstName}.`,
  });
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly students: StudentsRepository,
    private readonly upcomingTrials: UpcomingTrialsQuery,
  ) {}

  async list(parentId: string): Promise<Student[]> {
    const records = await this.students.listByParent(parentId);
    const trials = await this.upcomingTrials.byStudent(records.map((record) => record.id));
    return records.map((record) => toStudent(record, trials.get(record.id)));
  }

  async create(parentId: string, request: CreateStudentRequest): Promise<Student> {
    try {
      return toStudent(await this.students.insert(parentId, request), undefined);
    } catch (error) {
      if (isUniqueViolation(error, 'students_parent_name')) throw nameTaken(request.firstName);
      throw error;
    }
  }

  async update(parentId: string, id: string, changes: UpdateStudentRequest): Promise<Student> {
    // A malformed id cannot belong to anyone: same answer as someone else's child.
    if (!UUID.test(id)) throw notFound();
    try {
      if (!(await this.students.updateOwned(parentId, id, changes))) throw notFound();
    } catch (error) {
      if (isUniqueViolation(error, 'students_parent_name')) {
        throw nameTaken(changes.firstName ?? '');
      }
      throw error;
    }
    const record = await this.students.findOwned(parentId, id);
    if (record === null) throw notFound();
    const trials = await this.upcomingTrials.byStudent([id]);
    return toStudent(record, trials.get(id));
  }
}
