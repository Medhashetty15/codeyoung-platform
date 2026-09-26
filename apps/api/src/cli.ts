import 'reflect-metadata';

import { CommandFactory } from 'nest-commander';

import { runEntry } from './bootstrap/run-entry';
import { CliModule } from './cli.module';

runEntry('cli', async () => {
  await CommandFactory.run(CliModule, { logger: ['warn', 'error'] });
});
