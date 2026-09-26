import { Injectable, Logger } from '@nestjs/common';

import { type WaitlistRequest } from '@app/contracts';

import { Clock } from '../../../common/clock/clock';
import { maskEmail } from '../../../common/logging/redaction';
import { type WaitlistEntry, WaitlistRepository } from '../infra/waitlist.repository';

/** Join the waitlist when no time fits (FR-W1, E-16); idempotent per email while open. */
@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly waitlist: WaitlistRepository,
    private readonly clock: Clock,
  ) {}

  async join(
    request: WaitlistRequest,
    userId: string | null,
  ): Promise<{ entry: WaitlistEntry; created: boolean }> {
    const preferredTimes = request.preferredTimes ?? '';
    const result = await this.waitlist.addOpen({
      userId,
      fullName: request.fullName,
      email: request.email,
      timezone: request.timezone,
      preferredTimes: preferredTimes === '' ? null : preferredTimes,
      createdAt: this.clock.now(),
    });
    if (result.created) {
      this.logger.log(
        { email: maskEmail(request.email), linked: userId !== null },
        'Waitlist joined',
      );
    }
    return result;
  }
}
