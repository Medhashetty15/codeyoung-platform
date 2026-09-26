import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import '../zod-config';

describe('zod config', () => {
  it('turns off the eval probe even when zod loaded first (the CSP has no unsafe-eval)', () => {
    // zod is imported above, before the config module, like a hoisted chunk in the build.
    expect(z.config().jitless).toBe(true);
  });
});
