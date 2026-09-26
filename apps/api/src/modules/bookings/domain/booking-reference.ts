import { randomInt } from 'node:crypto';

// Crockford base32: no I, L, O or U, so references survive being read aloud.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A human booking reference such as `CY-7K3Q9P` (about 10^9 values). */
export function newBookingReference(): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) code += ALPHABET.charAt(randomInt(ALPHABET.length));
  return `CY-${code}`;
}
