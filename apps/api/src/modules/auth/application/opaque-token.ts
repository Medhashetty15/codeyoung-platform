import { createHash, randomBytes } from 'node:crypto';

/** 256 random bits, URL safe. Refresh tokens and password-reset tokens. */
export function newOpaqueToken(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}

/** Only this sha256 is stored; a database leak does not reveal usable tokens. */
export function hashOpaqueToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
