/** Where a class happens and each participant's personal link (docs/03 §8). */
export interface Meeting {
  meetingUrl: string;
  parentJoinToken: string;
  mentorJoinToken: string;
}

/** Swapping in Zoom or Meet later only changes the provider (C4). */
export abstract class MeetingProvider {
  abstract createMeeting(): Meeting;
  /** Personal join link for a token, e.g. the web app's classroom page. */
  abstract joinUrl(token: string): string;
}
