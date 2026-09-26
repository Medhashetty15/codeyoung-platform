import { Injectable } from '@nestjs/common';

/** Human-facing CLI output (stdout); logs go to the logger. Replaceable in tests. */
@Injectable()
export class CliOutput {
  line(text = ''): void {
    process.stdout.write(`${text}\n`);
  }

  error(text: string): void {
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;
  }
}
