import { Injectable } from '@nestjs/common';

import { ErrorCode, passwordPolicyViolations } from '@app/contracts';
import { isCommonPassword } from '@app/contracts/common-passwords';

import { AppError } from '../../../common/errors/app-error';

/** Server side of the shared password policy (docs/03 §6.3). */
@Injectable()
export class PasswordPolicy {
  /** @throws AppError WEAK_PASSWORD with every broken rule in `reasons` */
  assertAcceptable(password: string, email: string): void {
    const reasons = passwordPolicyViolations(password, email, isCommonPassword);
    if (reasons.length > 0) {
      throw new AppError(ErrorCode.WEAK_PASSWORD, {
        detail: 'Choose a stronger password.',
        extras: { reasons },
      });
    }
  }
}
