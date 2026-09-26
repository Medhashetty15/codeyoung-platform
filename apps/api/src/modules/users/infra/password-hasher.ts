import { Injectable } from '@nestjs/common';
import { argon2id, hash, needsRehash, verify } from 'argon2';

/** OWASP argon2id parameters (docs/03 §6.3): 19 MiB memory, 2 iterations, 1 lane. */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Hashes passwords as argon2id PHC strings; never logs or returns the plain text. */
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { ...ARGON2_OPTIONS, type: argon2id });
  }

  /** False for a wrong password or a malformed stored hash. */
  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** True when the stored hash used other parameters and should be replaced on login. */
  needsRehash(passwordHash: string): boolean {
    return needsRehash(passwordHash, ARGON2_OPTIONS);
  }
}
