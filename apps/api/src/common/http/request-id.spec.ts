import { type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { assignRequestId, requestIdOf, resolveRequestId } from './request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fakeRequest(headerValue?: string): IncomingMessage {
  return {
    headers: headerValue === undefined ? {} : { 'x-request-id': headerValue },
  } as IncomingMessage;
}

function fakeResponse() {
  const setHeader = vi.fn();
  return { response: { setHeader } as unknown as ServerResponse, setHeader };
}

describe('resolveRequestId', () => {
  it('keeps a well-formed upstream id', () => {
    expect(resolveRequestId('edge-7f3a9c21')).toBe('edge-7f3a9c21');
  });

  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['log injection', 'abcdefgh\nlevel=fatal'],
    ['too long', 'a'.repeat(129)],
    ['repeated header', ['aaaaaaaa', 'bbbbbbbb']],
  ])('mints a UUID when the incoming id is %s', (_label, incoming) => {
    expect(resolveRequestId(incoming)).toMatch(UUID);
  });
});

describe('assignRequestId', () => {
  it('stores the id on the request and echoes it as a header', () => {
    const request = fakeRequest('client-12345678');
    const { response, setHeader } = fakeResponse();

    const id = assignRequestId(request, response);

    expect(id).toBe('client-12345678');
    expect(requestIdOf(request)).toBe('client-12345678');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'client-12345678');
  });

  it('is idempotent so middleware and logger agree', () => {
    const request = fakeRequest();
    const { response, setHeader } = fakeResponse();

    const first = assignRequestId(request, response);
    const second = assignRequestId(request, response);

    expect(second).toBe(first);
    expect(setHeader).toHaveBeenCalledTimes(1);
  });

  it('reports an unknown id for requests that never got one', () => {
    expect(requestIdOf(fakeRequest())).toBe('unknown');
  });
});
