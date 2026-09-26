import { describe, expect, it, vi } from 'vitest';

import { AppConfig } from '../../config/app-config';

import { ConfigPrintCommand } from './config-print.command';

describe('ConfigPrintCommand', () => {
  it('prints the effective configuration without secrets', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const config = AppConfig.fromEnv({
      DATABASE_URL: 'postgres://codeyoung:s3cret@localhost:5433/codeyoung_dev',
    });

    await new ConfigPrintCommand(config).run();

    const output = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(output)).toMatchObject({
      port: 3000,
      database: 'postgres://localhost:5433/codeyoung_dev',
    });
    expect(output).not.toContain('s3cret');
  });
});
