import { REFRESH_COOKIE_NAME } from '@app/contracts';

export interface SetCookie {
  value: string;
  attributes: Map<string, string>;
}

/** The `cy_rt` Set-Cookie of a response, parsed; undefined when the response set none. */
export function refreshCookie(headers: Record<string, unknown>): SetCookie | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const cookie = cookies.find((item) => item.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (cookie === undefined) return undefined;
  const [pair = '', ...parts] = cookie.split(';').map((part) => part.trim());
  const attributes = new Map(
    parts.map((part) => {
      const [key = '', value = ''] = part.split('=');
      return [key.toLowerCase(), value] as const;
    }),
  );
  return { value: decodeURIComponent(pair.slice(REFRESH_COOKIE_NAME.length + 1)), attributes };
}

/** `Cookie` request header carrying a refresh token. */
export function cookieHeader(token: string): string {
  return `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

/** Like `refreshCookie`, but fails the test when the response set no refresh cookie. */
export function requireRefreshCookie(headers: Record<string, unknown>): SetCookie {
  const cookie = refreshCookie(headers);
  if (cookie === undefined) throw new Error('expected a refresh cookie');
  return cookie;
}
