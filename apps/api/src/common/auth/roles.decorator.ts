import { SetMetadata } from '@nestjs/common';

import { type UserRole } from '../../modules/users/infra/user.entity';

export const ROLES = 'cy:roles';

/** Restricts a route to roles. Only PARENT exists in the MVP; the hook is for MENTOR/ADMIN later. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES, roles);
