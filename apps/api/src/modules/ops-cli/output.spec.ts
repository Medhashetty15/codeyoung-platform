import { afterEach, describe, expect, it, vi } from 'vitest';

import { CliOutput } from './output';

describe('CliOutput.table', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function printed(run: (output: CliOutput) => void): string {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    run(new CliOutput());
    return write.mock.calls.map(([chunk]) => String(chunk)).join('');
  }

  it('aligns columns to the widest cell and trims trailing space', () => {
    expect(
      printed((output) => {
        output.table(
          ['ID', 'STATUS', 'NOTE'],
          [
            ['1', 'DEAD', ''],
            ['12345', 'PENDING', 'retry'],
          ],
        );
      }),
    ).toBe('ID     STATUS   NOTE\n1      DEAD\n12345  PENDING  retry\n');
  });

  it('says so when there is nothing to show', () => {
    expect(
      printed((output) => {
        output.table(['ID'], []);
      }),
    ).toBe('(none)\n');
  });
});
