import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../../common/clock/clock';
import { ExpiredCredentialsRepository } from '../infra/expired-credentials.repository';

/** Sessions stay this long after expiring, for support questions (docs/03 §7.1). */
const SESSION_RETENTION_DAYS = 30;

/** Worker job: delete expired refresh and reset tokens and long-expired sessions. */
@Injectable()
export class CredentialCleanupService {
  private readonly logger = new Logger(CredentialCleanupService.name);

  constructor(
    private readonly credentials: ExpiredCredentialsRepository,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<void> {
    const deleted = await this.credentials.deleteExpired(this.clock.now(), SESSION_RETENTION_DAYS);
    this.logger.log(deleted, 'Deleted expired credentials');
  }
}
