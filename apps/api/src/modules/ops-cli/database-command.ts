import { CommandRunner } from 'nest-commander';
import { type DataSource } from 'typeorm';

import { ensureConnected } from '../../database/connect';

/**
 * A command that needs the database. The CLI connects on demand (commands
 * like config:print run without one), so this opens the connection first.
 */
export abstract class DatabaseCommand<Options extends object> extends CommandRunner {
  protected constructor(private readonly dataSource: DataSource) {
    super();
  }

  async run(args: string[], options: Partial<Options> = {}): Promise<void> {
    await ensureConnected(this.dataSource);
    await this.execute(args, options);
  }

  protected abstract execute(args: string[], options: Partial<Options>): Promise<void>;
}
