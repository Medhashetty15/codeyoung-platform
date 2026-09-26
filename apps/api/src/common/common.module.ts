import { Global, Module } from '@nestjs/common';

import { Clock, SystemClock } from './clock/clock';

/** Cross-cutting providers shared by the API, worker and CLI. */
@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class CommonModule {}
