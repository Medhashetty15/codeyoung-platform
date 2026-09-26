import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { count } from '../../../common/text/count';
import {
  AccountDeletionService,
  AccountInUseError,
} from '../../users/application/account-deletion.service';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface UserAnonymiseOptions {
  yes: boolean;
}

@Command({
  name: 'user:anonymise',
  arguments: '<email>',
  description:
    'Handle a deletion request (A-14): anonymise the parent and children, keep booking history',
})
export class UserAnonymiseCommand extends DatabaseCommand<UserAnonymiseOptions> {
  constructor(
    dataSource: DataSource,
    private readonly deletions: AccountDeletionService,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<UserAnonymiseOptions>): Promise<void> {
    const [email = ''] = args;
    const account = await this.deletions.describe(email);
    this.output.line(
      `Account ${email}: ${account.fullName}, ${count(account.children, 'child', 'children')}, ` +
        `${count(account.bookings, 'booking')} (kept, without personal details).`,
    );
    if (account.upcomingReferences.length > 0) {
      throw new AccountInUseError(
        `The account has upcoming classes: ${account.upcomingReferences.join(', ')}. ` +
          'Cancel them first (booking:cancel), let the worker send the emails, then re-run.',
      );
    }
    this.output.line(
      "Name, email, phone, password, children's names, sessions and waitlist entries go.",
    );
    if (
      !(await this.prompt.confirm('Anonymise this account? This cannot be undone.', {
        yes: options.yes ?? false,
      }))
    ) {
      this.output.line('Nothing changed.');
      return;
    }
    const result = await this.deletions.anonymise(email);
    this.output.line(
      `Anonymised. Signed out ${count(result.sessions, 'session')}, removed ` +
        `${count(result.waitlistEntries, 'waitlist entry', 'waitlist entries')}, ` +
        `cancelled ${count(result.pendingMessages, 'unsent email')}.`,
    );
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
