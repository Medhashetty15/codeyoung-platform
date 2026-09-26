import 'reflect-metadata';

import { CommandFactory } from 'nest-commander';

import { runEntry } from './bootstrap/run-entry';
import { CliModule } from './cli.module';
import { reportCommandError } from './modules/ops-cli/command-errors';

runEntry('cli', async () => {
  await CommandFactory.run(CliModule, {
    logger: ['warn', 'error'],
    serviceErrorHandler: reportCommandError,
  });
});
