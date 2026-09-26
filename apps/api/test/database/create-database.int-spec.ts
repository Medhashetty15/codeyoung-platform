import { randomBytes } from 'node:crypto';

import { Client } from 'pg';
import { describe, expect, inject, it } from 'vitest';

import { createDatabaseIfMissing } from '../../src/database/create-database';

async function admin<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: inject('databaseUrl') });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe('createDatabaseIfMissing (db:create)', () => {
  it('creates the database once, in UTC, and leaves an existing one alone', async () => {
    const name = `created_${randomBytes(4).toString('hex')}`;
    const url = new URL(inject('databaseUrl'));
    url.pathname = `/${name}`;
    try {
      expect(await createDatabaseIfMissing(url.toString())).toBe(true);
      expect(await createDatabaseIfMissing(url.toString())).toBe(false);

      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      const { rows } = await client.query<{ TimeZone: string }>('SHOW timezone');
      await client.end();
      expect(rows[0]?.TimeZone).toBe('UTC');
    } finally {
      await admin((client) => client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    }
  });

  it('refuses names it would have to quote', async () => {
    const url = new URL(inject('databaseUrl'));
    url.pathname = '/bad"name';

    await expect(createDatabaseIfMissing(url.toString())).rejects.toThrow(
      'Unsupported database name',
    );
  });
});
