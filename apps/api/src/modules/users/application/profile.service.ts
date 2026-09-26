import { Injectable } from '@nestjs/common';

import { ErrorCode, type Me, type UpdateMeRequest } from '@app/contracts';

import { AppError } from '../../../common/errors/app-error';
import { toMe } from '../domain/me';
import { UsersRepository } from '../infra/users.repository';

@Injectable()
export class ProfileService {
  constructor(private readonly users: UsersRepository) {}

  async get(userId: string): Promise<Me> {
    const user = await this.users.findById(userId);
    // A valid token for a deleted account (ops anonymisation) is treated as signed out.
    if (user === null) throw new AppError(ErrorCode.UNAUTHENTICATED);
    return toMe(user);
  }

  /** Name, phone and zone only; the email is the login and cannot change in the MVP. */
  async update(userId: string, changes: UpdateMeRequest): Promise<Me> {
    await this.users.updateProfile(userId, changes);
    return this.get(userId);
  }
}
