import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../../../config/app-config';
import { type Meeting, MeetingProvider } from '../domain/meeting-provider';

/**
 * MVP provider: the "meeting" is our demo classroom page. Each participant gets
 * a 256-bit bearer token in their link; the token is the credential (FR-R1).
 */
@Injectable()
export class DummyMeetingProvider extends MeetingProvider {
  constructor(private readonly config: AppConfig) {
    super();
  }

  createMeeting(): Meeting {
    const parentJoinToken = randomBytes(32).toString('base64url');
    return {
      parentJoinToken,
      mentorJoinToken: randomBytes(32).toString('base64url'),
      meetingUrl: this.joinUrl(parentJoinToken),
    };
  }

  joinUrl(token: string): string {
    return `${this.config.webBaseUrl}/class/${token}`;
  }
}
