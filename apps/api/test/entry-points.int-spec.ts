import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';

import { CliModule } from '../src/cli.module';
import { AppConfig } from '../src/config/app-config';
import { ConfigPrintCommand } from '../src/modules/ops-cli/config-print.command';
import { WorkerModule } from '../src/worker.module';

const ENV_KEYS = ['DATABASE_URL', 'LOG_LEVEL', 'NODE_ENV'] as const;

describe('worker and CLI entry modules', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.DATABASE_URL = inject('databaseUrl');
    process.env.LOG_LEVEL = 'silent';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = saved[key];
    }
  });

  it('boots the worker context with a UTC database session', async () => {
    const worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    try {
      const dataSource = worker.get<DataSource>(getDataSourceToken());
      const rows: { timezone: string; application_name: string }[] = await dataSource.query(
        "SELECT current_setting('TimeZone') AS timezone, current_setting('application_name') AS application_name",
      );

      expect(rows).toEqual([{ timezone: 'UTC', application_name: 'codeyoung-worker' }]);
    } finally {
      await worker.close();
    }
  });

  it('boots the CLI context with its commands registered', async () => {
    const cli = await NestFactory.createApplicationContext(CliModule, { logger: false });
    try {
      expect(cli.get(ConfigPrintCommand)).toBeInstanceOf(ConfigPrintCommand);
      expect(cli.get(AppConfig).nodeEnv).toBe('test');
    } finally {
      await cli.close();
    }
  });
});
