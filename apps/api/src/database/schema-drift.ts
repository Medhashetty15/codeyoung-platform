import { type DataSource } from 'typeorm';

/**
 * SQL TypeORM would run to make the database match the entities. Empty means
 * no drift: the migrations and the entity metadata describe the same schema.
 */
export async function pendingSchemaChanges(dataSource: DataSource): Promise<string[]> {
  const sql = await dataSource.driver.createSchemaBuilder().log();
  return sql.upQueries.map((query) => query.query);
}
