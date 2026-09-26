import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseSeeder } from './database/seed/database-seeder';
import { ConfigPrintCommand } from './modules/ops-cli/config-print.command';
import { DbDriftCommand } from './modules/ops-cli/database/db-drift.command';
import { DbMigrateCommand } from './modules/ops-cli/database/db-migrate.command';
import { DbRevertCommand } from './modules/ops-cli/database/db-revert.command';
import { DbSeedCommand } from './modules/ops-cli/database/db-seed.command';
import { CliOutput } from './modules/ops-cli/output';
import { Prompt, TerminalPrompt } from './modules/ops-cli/prompt';
import { PasswordHasher } from './modules/users/infra/password-hasher';

/** Ops CLI (`npm run cli -- <command>`, docs/03 §10). */
@Module({
  imports: [ConfigModule, CommonModule, DatabaseModule.forRoot('cli')],
  providers: [
    { provide: Prompt, useClass: TerminalPrompt },
    CliOutput,
    PasswordHasher,
    DatabaseSeeder,
    ConfigPrintCommand,
    DbMigrateCommand,
    DbRevertCommand,
    DbDriftCommand,
    DbSeedCommand,
  ],
})
export class CliModule {}
