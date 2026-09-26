import { type Provider } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * Registers a repository class built on the default EntityManager. Services
 * rebind it to a transaction with `repository.withManager(manager)` (docs/03 §2).
 */
export function repositoryProvider(type: new (manager: EntityManager) => object): Provider {
  return {
    provide: type,
    inject: [DataSource],
    useFactory: (dataSource: DataSource) => new type(dataSource.manager),
  };
}
