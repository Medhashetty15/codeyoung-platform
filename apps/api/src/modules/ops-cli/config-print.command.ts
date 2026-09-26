import { Command, CommandRunner } from 'nest-commander';

import { AppConfig } from '../../config/app-config';

@Command({
  name: 'config:print',
  description: 'Validate the environment and print the effective configuration (no secrets)',
})
export class ConfigPrintCommand extends CommandRunner {
  constructor(private readonly config: AppConfig) {
    super();
  }

  run(): Promise<void> {
    process.stdout.write(`${JSON.stringify(this.config.describe(), null, 2)}\n`);
    return Promise.resolve();
  }
}
