import { argon2id, hash } from 'argon2';
import { describe, expect, it } from 'vitest';

import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id and the documented parameters', async () => {
    const digest = await hasher.hash('violet-harbour-lantern');

    expect(digest).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(digest).not.toContain('violet');
  });

  it('verifies the right password only', async () => {
    const digest = await hasher.hash('violet-harbour-lantern');

    expect(await hasher.verify(digest, 'violet-harbour-lantern')).toBe(true);
    expect(await hasher.verify(digest, 'violet-harbour-lanterN')).toBe(false);
  });

  it('treats a malformed hash as a failed verification', async () => {
    expect(await hasher.verify('not-a-hash', 'anything')).toBe(false);
  });

  it('asks for a rehash when parameters change', async () => {
    const weak = await hash('violet-harbour-lantern', {
      type: argon2id,
      memoryCost: 8192,
      timeCost: 1,
    });

    expect(hasher.needsRehash(weak)).toBe(true);
    expect(hasher.needsRehash(await hasher.hash('x'))).toBe(false);
  });
});
