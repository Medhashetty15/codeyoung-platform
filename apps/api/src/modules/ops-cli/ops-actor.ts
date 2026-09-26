import { userInfo } from 'node:os';

/** `ops:<os user>`, recorded in booking_events for ops changes (docs/03 §10). */
export function opsActor(): string {
  try {
    return `ops:${userInfo().username}`;
  } catch {
    // Containers can run as a uid without a passwd entry.
    return `ops:${process.env.USER ?? 'unknown'}`;
  }
}
