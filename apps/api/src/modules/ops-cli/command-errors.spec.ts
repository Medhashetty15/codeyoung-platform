import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@app/contracts';

import { AppError } from '../../common/errors/app-error';

import { describeCommandError, InvalidOptionError } from './command-errors';

describe('describeCommandError', () => {
  it('prints business refusals as title and detail', () => {
    expect(describeCommandError(new AppError(ErrorCode.BOOKING_NOT_FOUND))).toBe(
      'Booking not found',
    );
    expect(
      describeCommandError(
        new AppError(ErrorCode.BOOKING_NOT_MODIFIABLE, { detail: 'It has already started.' }),
      ),
    ).toBe('This booking can no longer be changed: It has already started.');
  });

  it('prints operator mistakes as their message and bugs with a stack', () => {
    expect(describeCommandError(new InvalidOptionError('--reason is required'))).toBe(
      '--reason is required',
    );
    expect(describeCommandError(new TypeError('boom'))).toMatch(/^TypeError: boom\n\s+at /);
  });
});
