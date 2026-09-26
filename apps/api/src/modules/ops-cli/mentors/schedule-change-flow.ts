import {
  type ChangeOutcome,
  ScheduleConflictError,
} from '../../bookings/application/mentor-schedule-changes.service';
import { type CliOutput } from '../output';
import { type Prompt } from '../prompt';

import { affectedLines } from './affected-bookings';

export interface ScheduleChangeRun<T> {
  output: CliOutput;
  prompt: Prompt;
  /** Lines describing the change, printed before anything else. */
  summary: readonly string[];
  question: string;
  reassign: boolean;
  yes: boolean;
  /** The change applied and rolled back: what it would strand. */
  preview: () => Promise<ChangeOutcome<T>>;
  apply: () => Promise<ChangeOutcome<T>>;
}

/**
 * Dry run, summary, confirmation, then the real change (docs/03 §10). A
 * change that strands booked classes needs --reassign; the move is all or
 * nothing, so a class nobody can cover leaves everything as it was.
 */
export async function runScheduleChange<T>(
  run: ScheduleChangeRun<T>,
): Promise<ChangeOutcome<T> | null> {
  const preview = await run.preview();
  for (const line of run.summary) run.output.line(line);
  const zone = preview.mentor.timezone;
  if (preview.affected.length > 0) {
    run.output.line('Booked classes this change strands:');
    for (const line of affectedLines(preview.affected, zone)) run.output.line(line);
    if (!run.reassign) {
      throw new ScheduleConflictError(
        'Re-run with --reassign to move them to other mentors, or cancel them first (booking:cancel).',
      );
    }
    run.output.line('They move to other mentors (all or nothing) and everyone is emailed.');
  }
  if (!(await run.prompt.confirm(run.question, { yes: run.yes }))) {
    run.output.line('Nothing changed.');
    return null;
  }
  const outcome = await run.apply();
  for (const moved of outcome.moved) run.output.line(`Moved ${moved.reference}.`);
  return outcome;
}
