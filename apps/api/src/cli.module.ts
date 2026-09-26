import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { ConfigPrintCommand } from './modules/ops-cli/config-print.command';

/** Ops CLI (`npm run cli -- <command>`, docs/03 §10). */
@Module({
  imports: [ConfigModule, CommonModule],
  providers: [ConfigPrintCommand],
})
export class CliModule {}
