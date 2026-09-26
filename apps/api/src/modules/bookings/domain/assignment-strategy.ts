import { type Temporal } from '@app/time';

/** What the strategy knows about a mentor who could take the slot. */
export interface MentorLoad {
  mentorId: string;
  /** Confirmed classes on the mentor-local date of the slot. */
  classesThatDay: number;
  /** Confirmed classes in the 7 days before the slot. */
  classesPastWeek: number;
  lastAssignedAt: Temporal.Instant | null;
}

/** Orders candidate mentors, best first (ADR 0011). Pluggable. */
export interface AssignmentStrategy {
  rank(candidates: readonly MentorLoad[]): MentorLoad[];
}

/**
 * docs/03 §5.2: fewest classes that day, then fewest in the trailing week,
 * then longest since last assigned (never assigned first), then mentor id so
 * the order is deterministic.
 */
export class LeastLoadedStrategy implements AssignmentStrategy {
  rank(candidates: readonly MentorLoad[]): MentorLoad[] {
    const assigned = (load: MentorLoad) => load.lastAssignedAt?.epochMilliseconds ?? -Infinity;
    return [...candidates].sort(
      (a, b) =>
        a.classesThatDay - b.classesThatDay ||
        a.classesPastWeek - b.classesPastWeek ||
        assigned(a) - assigned(b) ||
        a.mentorId.localeCompare(b.mentorId),
    );
  }
}
