import { Table } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { snakeCase, SnakeNamingStrategy } from './snake-naming.strategy';

describe('snakeCase', () => {
  it.each([
    ['mentorLocalDate', 'mentor_local_date'],
    ['icsSequence', 'ics_sequence'],
    ['id', 'id'],
    ['parentJoinToken', 'parent_join_token'],
    ['HTTPStatus', 'http_status'],
  ])('%s -> %s', (input, output) => {
    expect(snakeCase(input)).toBe(output);
  });
});

describe('SnakeNamingStrategy', () => {
  const naming = new SnakeNamingStrategy();

  it('snake-cases columns, keeping explicit names and embedded prefixes', () => {
    expect(naming.columnName('blockedUntil', undefined, [])).toBe('blocked_until');
    expect(naming.columnName('ignored', 'customName', [])).toBe('custom_name');
    expect(naming.columnName('city', undefined, ['homeAddress'])).toBe('home_address_city');
  });

  it('keeps explicit table names and snake-cases class names otherwise', () => {
    expect(naming.tableName('MentorTimeOff', 'mentor_time_off')).toBe('mentor_time_off');
    expect(naming.tableName('WaitlistEntry', undefined)).toBe('waitlist_entry');
  });

  it('names constraints the way PostgreSQL does', () => {
    expect(naming.primaryKeyName('users')).toBe('users_pkey');
    expect(naming.uniqueConstraintName('users', ['email'])).toBe('users_email_key');
    expect(naming.foreignKeyName('bookings', ['mentor_id'])).toBe('bookings_mentor_id_fkey');
    expect(naming.indexName('refresh_tokens', ['session_id'])).toBe(
      'refresh_tokens_session_id_idx',
    );
    expect(naming.joinColumnName('mentor', 'id')).toBe('mentor_id');
  });

  it('ignores the schema prefix of qualified tables', () => {
    expect(naming.primaryKeyName(new Table({ name: 'public.users' }))).toBe('users_pkey');
  });
});
