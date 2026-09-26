import { Client } from 'pg';

/** PostgreSQL identifiers we create: letters, digits and underscores only. */
const DATABASE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * Creates the database named in `databaseUrl` when it does not exist yet,
 * connecting to the server's `postgres` database. True when it was created.
 */
export async function createDatabaseIfMissing(databaseUrl: string): Promise<boolean> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!DATABASE_NAME.test(name)) throw new Error(`Unsupported database name "${name}"`);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount !== 0) return false;
    // Identifiers cannot be bound as parameters; the name is validated above.
    await client.query(`CREATE DATABASE "${name}"`);
    await client.query(`ALTER DATABASE "${name}" SET timezone TO 'UTC'`);
    return true;
  } finally {
    await client.end();
  }
}
