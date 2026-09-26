import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { canonicalZone } from '@app/time';

import { AppConfig } from '../../config/app-config';
import { MentorAvailabilityRuleEntity } from '../../modules/mentors/infra/mentor-availability-rule.entity';
import { MentorEntity } from '../../modules/mentors/infra/mentor.entity';
import { StudentEntity } from '../../modules/students/infra/student.entity';
import { PasswordHasher } from '../../modules/users/infra/password-hasher';
import { UserEntity } from '../../modules/users/infra/user.entity';
import { ensureConnected } from '../connect';

import {
  DEFAULT_DEMO_PASSWORD,
  SEED_EFFECTIVE_FROM,
  SEED_MENTOR_ZONE,
  SEED_MENTORS,
  SEED_PARENT,
  type SeedMentor,
} from './seed-data';

export interface SeedOptions {
  /** Empty every application table first (migrations history is kept). */
  reset: boolean;
}

export interface SeedSummary {
  reset: boolean;
  mentorsCreated: number;
  mentorsSkipped: number;
  availabilityRulesCreated: number;
  parentCreated: boolean;
  parentEmail: string;
  studentsCreated: number;
}

export class SeedRefusedError extends Error {
  override readonly name = 'SeedRefusedError';
}

/**
 * Loads demo data. Idempotent: existing mentors and the demo parent (matched
 * by email) are left untouched, so re-running never duplicates rows.
 */
@Injectable()
export class DatabaseSeeder {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly config: AppConfig,
  ) {}

  /** Tables `--reset` empties. */
  async tableNames(): Promise<string[]> {
    await ensureConnected(this.dataSource);
    return this.dataSource.entityMetadatas.map((metadata) => metadata.tableName).sort();
  }

  async seed(options: SeedOptions): Promise<SeedSummary> {
    if (this.config.isProduction) {
      throw new SeedRefusedError('Refusing to seed demo data into a production database.');
    }
    const passwordHash = await this.hasher.hash(
      this.config.seedDemoPassword ?? DEFAULT_DEMO_PASSWORD,
    );
    await ensureConnected(this.dataSource);

    return this.dataSource.transaction(async (manager) => {
      if (options.reset) await this.truncate(manager);
      const mentors = await this.seedMentors(manager);
      const parent = await this.seedParent(manager, passwordHash);
      return {
        reset: options.reset,
        ...mentors,
        ...parent,
        parentEmail: SEED_PARENT.email,
      };
    });
  }

  private async truncate(manager: EntityManager): Promise<void> {
    const tables = (await this.tableNames()).map((table) => `"${table}"`).join(', ');
    await manager.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }

  private async seedMentors(manager: EntityManager) {
    const zone = canonicalZone(SEED_MENTOR_ZONE);
    let mentorsCreated = 0;
    let availabilityRulesCreated = 0;
    for (const seed of SEED_MENTORS) {
      const existing = await manager.findOneBy(MentorEntity, { email: seed.email });
      if (existing !== null) continue;
      const mentor = await manager.save(
        manager.create(MentorEntity, {
          fullName: seed.fullName,
          email: seed.email,
          timezone: zone,
        }),
      );
      const rules = availabilityRules(mentor.id, seed);
      await manager.insert(MentorAvailabilityRuleEntity, rules);
      mentorsCreated += 1;
      availabilityRulesCreated += rules.length;
    }
    return {
      mentorsCreated,
      mentorsSkipped: SEED_MENTORS.length - mentorsCreated,
      availabilityRulesCreated,
    };
  }

  private async seedParent(manager: EntityManager, passwordHash: string) {
    const existing = await manager.findOneBy(UserEntity, { email: SEED_PARENT.email });
    if (existing !== null) return { parentCreated: false, studentsCreated: 0 };

    const parent = await manager.save(
      manager.create(UserEntity, {
        fullName: SEED_PARENT.fullName,
        email: SEED_PARENT.email,
        phone: SEED_PARENT.phone,
        timezone: canonicalZone(SEED_PARENT.timezone),
        passwordHash,
      }),
    );
    await manager.insert(
      StudentEntity,
      SEED_PARENT.children.map((child) => ({ ...child, parentId: parent.id })),
    );
    return { parentCreated: true, studentsCreated: SEED_PARENT.children.length };
  }
}

function availabilityRules(
  mentorId: string,
  seed: SeedMentor,
): Partial<MentorAvailabilityRuleEntity>[] {
  return seed.windows.flatMap((window) =>
    window.weekdays.map((weekday) => ({
      mentorId,
      weekday,
      startLocal: window.start,
      endLocal: window.end,
      effectiveFrom: SEED_EFFECTIVE_FROM,
      effectiveTo: null,
    })),
  );
}
