import { DefaultNamingStrategy, type NamingStrategyInterface, type Table } from 'typeorm';

/** `mentorLocalDate` -> `mentor_local_date`. */
export function snakeCase(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * snake_case columns (docs/03 §2) and PostgreSQL's own constraint naming
 * (`users_pkey`, `bookings_mentor_id_fkey`, `users_email_key`), so migrations
 * read like hand-written SQL and the drift check compares stable names.
 * Checks, exclusions and partial indexes are always named explicitly.
 * (typeorm-naming-strategies does not support TypeORM 1.x.)
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase([...embeddedPrefixes, customName ?? propertyName].join('_'));
  }

  override primaryKeyName(tableOrName: Table | string): string {
    return `${this.getTableName(tableOrName)}_pkey`;
  }

  override uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    return `${this.getTableName(tableOrName)}_${columnNames.join('_')}_key`;
  }

  override foreignKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return `${this.getTableName(tableOrName)}_${columnNames.join('_')}_fkey`;
  }

  override indexName(tableOrName: Table | string, columnNames: string[]): string {
    return `${this.getTableName(tableOrName)}_${columnNames.join('_')}_idx`;
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  // Unqualified name: the schema prefix is never part of a constraint name.
  protected override getTableName(tableOrName: Table | string): string {
    const name = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
    return name.split('.').at(-1) ?? name;
  }
}
