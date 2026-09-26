import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';

import { AppConfig } from '../../config/app-config';

/**
 * Throttler that scales every limit by RATE_LIMIT_MULTIPLIER (PD-10), so e2e
 * runs can relax the documented limits without editing each route.
 */
@Injectable()
export class ScaledThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: AppConfig,
  ) {
    super(options, storage, reflector);
  }

  protected override handleRequest(request: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({ ...request, limit: this.config.scaledLimit(request.limit) });
  }
}
