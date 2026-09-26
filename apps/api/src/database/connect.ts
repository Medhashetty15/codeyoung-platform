import { type DataSource } from 'typeorm';

/** Opens the connection if it is not open yet (CLI data sources start closed). */
export async function ensureConnected(dataSource: DataSource): Promise<DataSource> {
  if (!dataSource.isInitialized) await dataSource.initialize();
  return dataSource;
}
