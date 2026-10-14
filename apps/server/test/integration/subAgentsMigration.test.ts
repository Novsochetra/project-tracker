import { sql } from 'kysely';
import type { Project } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { MIGRATIONS } from '../../src/db/migrations';
import { createMigrator, migrateToLatest } from '../../src/db/migrator';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { clientFor, DIALECTS, openEmptyDatabase } from '../helpers/server';

const BEFORE = Object.fromEntries(
  Object.entries(MIGRATIONS).filter(([name]) => name < '0026_sub_agents'),
);

describe.each(DIALECTS)('sub agents migration (%s)', (dialect) => {
  it('gives a project from before it 3 sub agents per ticket', async () => {
    const db = openEmptyDatabase(dialect);
    try {
      expect((await createMigrator(db, BEFORE).migrateToLatest()).error).toBeUndefined();
      await sql`insert into projects (id, name, key, description, repo, color, next_num,
        created_at, updated_at) values ('p-mob', 'Mobile app', 'MOB', '', '', '#5B5BD6', 1,
        1000, 1000)`.execute(db);
      await migrateToLatest(db);
      const client = clientFor(
        createApp({ db, storage: createMemoryStorage(), events: createBroadcaster() }),
      );
      const projects: Project[] = await client.listProjects();
      expect(projects.map((project) => [project.key, project.maxSubAgents])).toEqual([['MOB', 3]]);
    } finally {
      await db.destroy();
    }
  });
});
