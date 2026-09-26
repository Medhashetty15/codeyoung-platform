import { Injectable } from '@nestjs/common';

/** Human-facing CLI output (stdout); logs go to the logger. Replaceable in tests. */
@Injectable()
export class CliOutput {
  line(text = ''): void {
    process.stdout.write(`${text}\n`);
  }

  /** Left-aligned columns, header first; empty rows print "(none)". */
  table(header: readonly string[], rows: readonly (readonly string[])[]): void {
    if (rows.length === 0) {
      this.line('(none)');
      return;
    }
    const widths = header.map((title, column) =>
      Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
    );
    const format = (cells: readonly string[]) =>
      cells
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join('  ')
        .trimEnd();
    this.line(format(header));
    for (const row of rows) this.line(format(row));
  }

  error(text: string): void {
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;
  }
}
