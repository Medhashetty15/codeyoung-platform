import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportCommandError } from './command-errors';
import { ConfirmationRequiredError, TerminalPrompt } from './prompt';

describe('TerminalPrompt', () => {
  const isTTY = process.stdin.isTTY;

  afterEach(() => {
    process.stdin.isTTY = isTTY;
  });

  it('skips the question with --yes', async () => {
    await expect(new TerminalPrompt().confirm('Delete?', { yes: true })).resolves.toBe(true);
  });

  it('refuses to guess in a non-interactive shell', async () => {
    process.stdin.isTTY = false;

    await expect(new TerminalPrompt().confirm('Delete?', { yes: false })).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
  });
});

describe('reportCommandError', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints operator mistakes as a plain message and fails the process', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    reportCommandError(new ConfirmationRequiredError('Re-run with --yes'));

    expect(write).toHaveBeenCalledWith('Re-run with --yes\n');
    expect(process.exitCode).toBe(1);
  });

  it('keeps the stack trace for unexpected errors', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const error = new Error('connection refused');

    reportCommandError(error);

    expect(String(write.mock.calls[0]?.[0])).toContain('at ');
    expect(process.exitCode).toBe(1);
  });
});
