import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { Injectable } from '@nestjs/common';

export class ConfirmationRequiredError extends Error {
  override readonly name = 'ConfirmationRequiredError';
}

/** Asks the operator before destructive writes (docs/03 §10). Replaceable in tests. */
export abstract class Prompt {
  /** Resolves true only on an explicit yes; `--yes` skips the question. */
  abstract confirm(question: string, options: { yes: boolean }): Promise<boolean>;
}

@Injectable()
export class TerminalPrompt extends Prompt {
  async confirm(question: string, { yes }: { yes: boolean }): Promise<boolean> {
    if (yes) return true;
    if (!stdin.isTTY) {
      throw new ConfirmationRequiredError(
        'This command changes data and needs confirmation. Re-run with --yes in scripts.',
      );
    }
    const terminal = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await terminal.question(`${question} [y/N] `);
      return /^y(es)?$/i.test(answer.trim());
    } finally {
      terminal.close();
    }
  }
}
