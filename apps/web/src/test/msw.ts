import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { handlers } from '../mocks/handlers';

/** One MSW server for all component tests, starting from the fixture handlers; tests add scenarios with server.use(). */
export const server = setupServer(...handlers);

export function problem(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers: HeadersInit = {},
) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, code, traceId: '7f3a91c2e0d4', ...extra },
    { status, headers },
  );
}
