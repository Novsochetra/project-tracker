import { sql } from 'kysely';
import { NO_MIGRATIONS, type MigrationResultSet } from 'kysely/migration';
import { beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../../src/db/migrations';
import { createMigrator, migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { exactSchema, portableSchema, readSchema, type SchemaShape } from '../helpers/schemaShape';
import {
  DIALECTS,
  emptyPgliteDataDir,
  openEmptyDatabase,
  type TestDialect,
} from '../helpers/server';

const NAMES = Object.keys(MIGRATIONS).sort();

async function expectRan(run: Promise<MigrationResultSet>, names: string[]): Promise<void> {
  const { error, results } = await run;
  expect(error).toBeUndefined();
  expect(results?.map((result) => [result.migrationName, result.status])).toEqual(
    names.map((name) => [name, 'Success']),
  );
}

// Every migration in turn: up, down (the schema must be what it was before), up again (the schema
// must be what the first up made). Gives the portable schema after each.
async function stepThrough(db: Db, dialect: TestDialect): Promise<SchemaShape[]> {
  const migrator = createMigrator(db);
  const start = await readSchema(db, dialect);
  let before = start.exact;
  const steps = [start.portable];
  for (const name of NAMES) {
    await expectRan(migrator.migrateUp(), [name]);
    const after = await exactSchema(db, dialect);
    await expectRan(migrator.migrateDown(), [name]);
    expect(await exactSchema(db, dialect), `${name} down() undoes its up()`).toEqual(before);
    await expectRan(migrator.migrateUp(), [name]);
    const again = await readSchema(db, dialect);
    expect(again.exact, `${name} up() after its down()`).toEqual(after);
    before = after;
    steps.push(again.portable);
  }
  return steps;
}

// Each test starts from a copy of one empty PGlite, made once: initdb per test took most of the
// time, and under a loaded machine's verify run a test needed 64 s.
let pgliteDataDir: Blob | undefined;

beforeAll(async () => {
  pgliteDataDir = await emptyPgliteDataDir();
});

async function withDatabase<T>(dialect: TestDialect, work: (db: Db) => Promise<T>): Promise<T> {
  const db = openEmptyDatabase(dialect, pgliteDataDir);
  try {
    return await work(db);
  } finally {
    await db.destroy();
  }
}

const appliedNames = async (db: Db) =>
  (await sql<{ name: string }>`select name from kysely_migration`.execute(db)).rows
    .map((row) => row.name)
    .sort();

describe.each(DIALECTS)('every migration up and down (%s)', (dialect) => {
  it('undoes each migration exactly, and applies it again the same way', async () => {
    const steps = await withDatabase(dialect, (db) => stepThrough(db, dialect));
    expect(steps).toHaveLength(NAMES.length + 1);
  });

  it('goes all the way down to an empty database and back up to the same schema', async () => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      const latest = await exactSchema(db, dialect);

      await expectRan(createMigrator(db).migrateTo(NO_MIGRATIONS), [...NAMES].reverse());
      expect(await exactSchema(db, dialect)).toEqual({});
      expect(await appliedNames(db)).toEqual([]);

      expect(await migrateToLatest(db)).toEqual(NAMES);
      expect(await exactSchema(db, dialect)).toEqual(latest);
      expect(await appliedNames(db)).toEqual(NAMES);
    });
  });

  it('keeps the rows of the tables a rollback leaves in place', async () => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      await sql`insert into projects (id, name, key, description, repo, color, next_num, created_at,
        updated_at) values ('p', 'Mobile', 'MOB', '', '', '#5B5BD6', 2, 1000, 1000)`.execute(db);
      await sql`insert into statuses (id, project_id, name, category, color, position, created_at)
        values ('s', 'p', 'To do', 'todo', '#8E8E99', 0, 1000)`.execute(db);
      await sql`insert into tickets (id, project_id, num, status_id, rank, title, description,
        priority, assignee, due, created_at, updated_at, client_id) values ('t', 'p', 1, 's', 0,
        'Crash', '', 'high', '', '', 1000, 1000, 'c-1')`.execute(db);
      await sql`insert into attachments (id, ticket_id, file_name, mime_type, size, storage_key,
        created_at, position) values ('f', 't', 'a.txt', 'text/plain', 5, 'f.txt', 1000, 3)`.execute(
        db,
      );

      await expectRan(
        createMigrator(db).migrateTo('0001_initial'),
        NAMES.filter((name) => name > '0001_initial').reverse(),
      );
      await migrateToLatest(db);

      const ticket = await sql<{ title: string; clientId: string | null }>`
        select title, client_id from tickets`.execute(db);
      expect(ticket.rows).toEqual([{ title: 'Crash', clientId: null }]);
      const file = await sql<{ id: string; position: number }>`
        select id, position from attachments`.execute(db);
      expect(file.rows).toEqual([{ id: 'f', position: 0 }]);
    });
  });

  it('gives the one account every project and file as their owner, and keeps them on rollback', async () => {
    await withDatabase(dialect, async (db) => {
      const migrator = createMigrator(db);
      await expectRan(
        migrator.migrateTo('0010_ask_effort'),
        NAMES.filter((name) => name <= '0010_ask_effort'),
      );
      await sql`insert into users (id, email, password_hash, created_at, updated_at)
        values ('u', 'owner@example.com', 'hash', 1000, 1000)`.execute(db);
      for (const [id, key] of [
        ['pt', 'PT'],
        ['awp', 'AWP'],
      ]) {
        await sql`insert into projects (id, name, key, description, repo, color, next_num,
          created_at, updated_at) values (${id}, ${key}, ${key}, '', '', '#5B5BD6', 1, 1000, 1000)`.execute(
          db,
        );
      }
      await sql`insert into attachments (id, file_name, mime_type, size, storage_key, created_at,
        position) values ('f', 'a.txt', 'text/plain', 5, 'f.txt', 1000, 0)`.execute(db);

      await migrateToLatest(db);
      const users = await sql<{ role: string; name: string }>`select role, name from users`.execute(
        db,
      );
      expect(users.rows).toEqual([{ role: 'owner', name: '' }]);
      const owners = await sql<{ ownerId: string }>`select owner_id from projects`.execute(db);
      expect(owners.rows).toEqual([{ ownerId: 'u' }, { ownerId: 'u' }]);
      const files = await sql<{ userId: string }>`select user_id from attachments`.execute(db);
      expect(files.rows).toEqual([{ userId: 'u' }]);

      await migrator.migrateTo('0010_ask_effort');
      const keys = await sql<{ key: string }>`select key from projects order by key`.execute(db);
      expect(keys.rows).toEqual([{ key: 'AWP' }, { key: 'PT' }]);

      await migrateToLatest(db);
      const again = await sql<{ ownerId: string }>`select owner_id from projects`.execute(db);
      expect(again.rows).toEqual([{ ownerId: 'u' }, { ownerId: 'u' }]);
    });
  });

  it('leaves projects to nobody on a tracker without an account, for owner-set to give out', async () => {
    await withDatabase(dialect, async (db) => {
      await createMigrator(db).migrateTo('0010_ask_effort');
      await sql`insert into projects (id, name, key, description, repo, color, next_num,
        created_at, updated_at) values ('p', 'Mobile', 'MOB', '', '', '#5B5BD6', 1, 1000, 1000)`.execute(
        db,
      );
      await migrateToLatest(db);
      const owners = await sql<{ ownerId: string | null }>`select owner_id from projects`.execute(
        db,
      );
      expect(owners.rows).toEqual([{ ownerId: null }]);
    });
  });

  it('gives a chat made before efforts the default, and keeps its other choices on rollback', async () => {
    await withDatabase(dialect, async (db) => {
      const migrator = createMigrator(db);
      await expectRan(
        migrator.migrateTo('0009_run_requests'),
        NAMES.filter((name) => name <= '0009_run_requests'),
      );
      await sql`insert into projects (id, name, key, description, repo, color, next_num, created_at,
        updated_at) values ('p', 'Mobile', 'MOB', '', '', '#5B5BD6', 1, 1000, 1000)`.execute(db);
      await sql`insert into chats (id, project_id, title, created_at, updated_at, ask_model,
        ask_mode) values ('c', 'p', 'Q', 1000, 1000, 'opus', 'plan')`.execute(db);

      await migrateToLatest(db);
      const after = await sql<{ askEffort: string }>`select ask_effort from chats`.execute(db);
      expect(after.rows).toEqual([{ askEffort: 'default' }]);

      await expectRan(
        migrator.migrateTo('0009_run_requests'),
        NAMES.filter((name) => name > '0009_run_requests').reverse(),
      );
      const back = await sql<{ askModel: string }>`select ask_model from chats`.execute(db);
      expect(back.rows).toEqual([{ askModel: 'opus' }]);
    });
  });

  it("moves a message's ticket to its first card, and back on rollback", async () => {
    await withDatabase(dialect, async (db) => {
      const before = NAMES.filter((name) => name < '0021_card_tickets').at(-1)!;
      const migrator = createMigrator(db);
      await migrator.migrateTo(before);
      await sql`insert into projects (id, name, key, description, repo, color, next_num,
        created_at, updated_at) values ('p', 'Mobile', 'MOB', '', '', '#5B5BD6', 3, 1000, 1000)`.execute(
        db,
      );
      await sql`insert into statuses (id, project_id, name, category, color, position, created_at)
        values ('s', 'p', 'To do', 'todo', '#8E8E93', 0, 1000)`.execute(db);
      for (const [id, num] of [
        ['t1', 1],
        ['t2', 2],
      ] as const) {
        await sql`insert into tickets (id, project_id, num, status_id, rank, title, description,
          priority, assignee, due, created_at, updated_at) values (${id}, 'p', ${num}, 's', ${num},
          'T', '', 'medium', '', '', 1000, 1000)`.execute(db);
      }
      await sql`insert into chats (id, project_id, title, created_at, updated_at)
        values ('c', 'p', 'Q', 1000, 1000)`.execute(db);
      await sql`insert into chat_messages (id, chat_id, role, text, ticket_id, created_at) values
        ('made', 'c', 'claude', 'card', 't1', 1000),
        ('open', 'c', 'claude', 'card', null, 1001)`.execute(db);

      await migrator.migrateTo('0021_card_tickets');
      const links = sql`select message_id, card_index, ticket_id from chat_card_tickets
        order by card_index`;
      expect((await links.execute(db)).rows).toEqual([
        { messageId: 'made', cardIndex: 0, ticketId: 't1' },
      ]);

      await sql`insert into chat_card_tickets (message_id, card_index, ticket_id)
        values ('open', 0, 't2'), ('made', 1, 't2')`.execute(db);
      await migrator.migrateTo(before);
      const back = await sql<{ id: string; ticketId: string | null }>`select id, ticket_id
        from chat_messages order by created_at`.execute(db);
      expect(back.rows).toEqual([
        { id: 'made', ticketId: 't1' },
        { id: 'open', ticketId: 't2' },
      ]);
    });
  });

  it('keeps one open reset link per account, and drops reset links on rollback', async () => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      await sql`insert into users (id, email, password_hash, created_at, updated_at, role)
        values ('o', 'owner@example.com', 'hash', 1000, 1000, 'owner')`.execute(db);
      await sql`insert into invites (id, token_hash, created_by, created_at, expires_at)
        values ('i', 'invite-hash', 'o', 1000, 2000)`.execute(db);
      await sql`insert into invites (id, token_hash, created_by, created_at, expires_at, kind,
        user_id) values ('r', 'reset-hash', 'o', 1000, 2000, 'reset', 'o')`.execute(db);
      const second = sql`insert into invites (id, token_hash, created_by, created_at, expires_at,
        kind, user_id) values ('r2', 'second-hash', 'o', 1000, 2000, 'reset', 'o')`.execute(db);
      await expect(second).rejects.toThrow();
      await sql`insert into invites (id, token_hash, created_by, created_at, expires_at, kind,
        user_id, used_at) values ('r3', 'used-hash', 'o', 1000, 2000, 'reset', 'o', 1500)`.execute(
        db,
      );

      const later = NAMES.filter((name) => name > '0011_user_projects').reverse();
      await expectRan(createMigrator(db).migrateTo('0011_user_projects'), later);
      const kept = await sql<{ id: string }>`select id from invites`.execute(db);
      expect(kept.rows).toEqual([{ id: 'i' }]);

      await migrateToLatest(db);
      const kinds = await sql<{ kind: string }>`select kind from invites`.execute(db);
      expect(kinds.rows).toEqual([{ kind: 'invite' }]);
    });
  });
});

// The data model of docs/architecture.md §2, as both databases report it. Every table: matching
// only the ones listed let the sign-in tables go unchecked.
const DATA_MODEL: SchemaShape = {
  projects: {
    columns: [
      'id text primary key',
      'name text not null',
      'key text not null',
      'description text not null',
      'repo text not null',
      'color text not null',
      'next_num integer not null',
      'created_at bigint not null',
      'updated_at bigint not null',
      'owner_id text',
      "instructions text not null default ''",
      'auto_review integer',
      'max_parallel_runs integer not null default 5',
      'max_sub_agents integer not null default 3',
      'hide_name integer not null default 0',
    ],
    indexes: ['index (owner_id)', 'unique (key)'],
    foreignKeys: [],
  },
  statuses: {
    columns: [
      'id text primary key',
      'project_id text not null',
      'name text not null',
      'category text not null',
      'color text not null',
      'position integer not null',
      'created_at bigint not null',
    ],
    indexes: ['index (project_id, position)'],
    foreignKeys: ['project_id -> projects.id on delete cascade'],
  },
  tickets: {
    columns: [
      'id text primary key',
      'project_id text not null',
      'num integer not null',
      'status_id text not null',
      'rank integer not null',
      'title text not null',
      'description text not null',
      'priority text not null',
      'assignee text not null',
      'due text not null',
      'created_at bigint not null',
      'updated_at bigint not null',
      'client_id text',
      'needs_device integer not null default 0',
    ],
    indexes: [
      'index (project_id, status_id, rank)',
      'unique (project_id, client_id)',
      'unique (project_id, num)',
    ],
    foreignKeys: [
      'project_id -> projects.id on delete cascade',
      'status_id -> statuses.id on delete restrict',
    ],
  },
  activities: {
    columns: [
      'id text primary key',
      'ticket_id text not null',
      'type text not null',
      'actor_kind text not null',
      'actor_name text not null',
      'text text not null',
      'review_verdict text',
      'review_rating integer',
      'created_at bigint not null',
      'edited_at bigint',
      'line_run_id text',
      'line_path text',
      'line_side text',
      'line_number integer',
    ],
    indexes: ['index (ticket_id, created_at)'],
    foreignKeys: ['ticket_id -> tickets.id on delete cascade'],
  },
  attachments: {
    columns: [
      'id text primary key',
      'ticket_id text',
      'activity_id text',
      'file_name text not null',
      'mime_type text not null',
      'size integer not null',
      'width integer',
      'height integer',
      'storage_key text not null',
      'created_at bigint not null',
      'position integer not null default 0',
      'user_id text',
      'chat_message_id text',
    ],
    indexes: ['index (activity_id)', 'index (chat_message_id)', 'index (ticket_id)'],
    foreignKeys: [
      'activity_id -> activities.id on delete cascade',
      'chat_message_id -> chat_messages.id on delete cascade',
      'ticket_id -> tickets.id on delete cascade',
    ],
  },
  users: {
    columns: [
      'id text primary key',
      'email text not null',
      'password_hash text not null',
      'created_at bigint not null',
      'updated_at bigint not null',
      "name text not null default ''",
      "role text not null default 'user'",
    ],
    indexes: ['unique (email)'],
    foreignKeys: [],
  },
  invites: {
    columns: [
      'id text primary key',
      'token_hash text not null',
      'created_by text not null',
      'created_at bigint not null',
      'expires_at bigint not null',
      'used_at bigint',
      'used_by text',
      "kind text not null default 'invite'",
      'user_id text',
    ],
    indexes: ['unique (token_hash)', 'unique (user_id)'],
    foreignKeys: [
      'created_by -> users.id on delete cascade',
      'used_by -> users.id on delete set null',
    ],
  },
  sessions: {
    columns: [
      'id text primary key',
      'user_id text not null',
      'created_at bigint not null',
      'last_seen_at bigint not null',
      'expires_at bigint not null',
    ],
    indexes: ['index (user_id)'],
    foreignKeys: ['user_id -> users.id on delete cascade'],
  },
  api_tokens: {
    columns: [
      'id text primary key',
      'user_id text not null',
      'name text not null',
      'hint text not null',
      'token_hash text not null',
      'created_at bigint not null',
      'last_used_at bigint',
    ],
    indexes: ['index (user_id)', 'unique (token_hash)'],
    foreignKeys: ['user_id -> users.id on delete cascade'],
  },
  runners: {
    columns: [
      'id text primary key',
      'user_id text',
      'name text not null',
      'project_ids text not null',
      'created_at bigint not null',
      'last_seen_at bigint not null',
      'tools text',
    ],
    indexes: ['index (user_id)'],
    foreignKeys: ['user_id -> users.id on delete cascade'],
  },
  runs: {
    columns: [
      'id text primary key',
      'user_id text',
      'project_id text not null',
      'ticket_id text',
      'runner_id text',
      'runner_name text not null',
      'prompt text not null',
      'status text not null',
      'error text',
      'created_at bigint not null',
      'started_at bigint',
      'ended_at bigint',
      "kind text not null default 'ticket'",
      'chat_id text',
      'resume_session_id text',
      'ask_model text',
      'ask_mode text',
      'step_count integer not null default 0',
      'ask_effort text',
      'role text',
      'cost_micros bigint',
      'turns integer',
      'duration_ms bigint',
      'round integer',
      'chain_stop text',
      'question_id text',
      'batch_id text',
      'context_tokens bigint',
      'context_window bigint',
      'tokens bigint',
    ],
    indexes: [
      'index (batch_id)',
      'index (chat_id, created_at)',
      'index (project_id, ended_at)',
      'index (runner_id, status)',
      'index (status, created_at)',
      'unique (chat_id)',
      'unique (ticket_id)',
    ],
    foreignKeys: [
      'chat_id -> chats.id on delete cascade',
      'project_id -> projects.id on delete cascade',
      'runner_id -> runners.id on delete set null',
      'ticket_id -> tickets.id on delete cascade',
      'user_id -> users.id on delete cascade',
    ],
  },
  run_steps: {
    columns: [
      'run_id text primary key',
      'seq integer primary key',
      'kind text not null',
      'label text not null',
      'sub_agent integer not null',
      'tool_id text',
      'created_at bigint not null',
      'todos text',
    ],
    indexes: [],
    foreignKeys: ['run_id -> runs.id on delete cascade'],
  },
  run_requests: {
    columns: [
      'id text primary key',
      'run_id text not null',
      'kind text not null',
      'label text not null',
      'label_cut integer not null',
      'questions text',
      'status text not null',
      'decision text',
      'answers text',
      'created_at bigint not null',
      'expires_at bigint not null',
      'ended_at bigint',
    ],
    indexes: ['index (run_id, created_at)', 'index (status, expires_at)'],
    foreignKeys: ['run_id -> runs.id on delete cascade'],
  },
  run_changes: {
    columns: [
      'run_id text primary key',
      'ticket_id text not null',
      'diff text not null',
      'cut integer not null',
      'verdict text',
      'created_at bigint not null',
    ],
    indexes: ['index (ticket_id, created_at)'],
    foreignKeys: [
      'run_id -> runs.id on delete cascade',
      'ticket_id -> tickets.id on delete cascade',
    ],
  },
  ticket_viewed_files: {
    columns: [
      'ticket_id text primary key',
      'path text primary key',
      'digest text not null',
      'created_at bigint not null',
    ],
    indexes: [],
    foreignKeys: ['ticket_id -> tickets.id on delete cascade'],
  },
  questions: {
    columns: [
      'id text primary key',
      'user_id text',
      'ticket_id text not null',
      'run_id text',
      'text text not null',
      'choices text not null',
      'status text not null',
      'answer text',
      'created_at bigint not null',
      'expires_at bigint not null',
      'ended_at bigint',
    ],
    indexes: ['index (status, expires_at)', 'index (ticket_id, created_at)'],
    foreignKeys: [
      'run_id -> runs.id on delete set null',
      'ticket_id -> tickets.id on delete cascade',
      'user_id -> users.id on delete cascade',
    ],
  },
  chats: {
    columns: [
      'id text primary key',
      'user_id text',
      'project_id text not null',
      'title text not null',
      'session_id text',
      'session_runner_id text',
      'created_at bigint not null',
      'updated_at bigint not null',
      "ask_model text not null default 'default'",
      "ask_mode text not null default 'ask'",
      "ask_effort text not null default 'default'",
      'ticket_id text',
    ],
    indexes: ['index (project_id, updated_at)', 'index (ticket_id)'],
    foreignKeys: [
      'project_id -> projects.id on delete cascade',
      'ticket_id -> tickets.id on delete set null',
      'user_id -> users.id on delete cascade',
    ],
  },
  chat_messages: {
    columns: [
      'id text primary key',
      'chat_id text not null',
      'role text not null',
      'text text not null',
      'ticket_id text',
      'created_at bigint not null',
      'run_id text',
      'batch_run_id text',
    ],
    indexes: ['index (chat_id, created_at)'],
    foreignKeys: [
      'chat_id -> chats.id on delete cascade',
      'ticket_id -> tickets.id on delete set null',
    ],
  },
  chat_card_tickets: {
    columns: [
      'message_id text primary key',
      'card_index integer primary key',
      'ticket_id text not null',
    ],
    indexes: ['index (ticket_id)'],
    foreignKeys: [
      'message_id -> chat_messages.id on delete cascade',
      'ticket_id -> tickets.id on delete cascade',
    ],
  },
  chat_queue: {
    columns: [
      'message_id text primary key',
      'chat_id text not null',
      'runner_id text not null',
      'ask_model text not null',
      'ask_mode text not null',
      'ask_effort text not null',
      'position integer not null',
    ],
    indexes: ['unique (chat_id, position)'],
    foreignKeys: [
      'chat_id -> chats.id on delete cascade',
      'message_id -> chat_messages.id on delete cascade',
    ],
  },
  push_subscriptions: {
    columns: [
      'id text primary key',
      'user_id text',
      'session_id text',
      'endpoint text not null',
      'p256dh text not null',
      'auth text not null',
      'created_at bigint not null',
    ],
    indexes: ['index (user_id)', 'unique (endpoint)'],
    foreignKeys: [
      'session_id -> sessions.id on delete cascade',
      'user_id -> users.id on delete cascade',
    ],
  },
  push_keys: {
    columns: [
      'id text primary key',
      'public_key text not null',
      'private_key text not null',
      'created_at bigint not null',
    ],
    indexes: [],
    foreignKeys: [],
  },
  labels: {
    columns: [
      'id text primary key',
      'project_id text not null',
      'name text not null',
      'color text not null',
      "template text not null default ''",
      "instructions text not null default ''",
      'position integer not null',
      'created_at bigint not null',
    ],
    indexes: ['index (project_id)'],
    foreignKeys: ['project_id -> projects.id on delete cascade'],
  },
  ticket_labels: {
    columns: [
      'id text primary key',
      'ticket_id text not null',
      'label_id text not null',
      'created_at bigint not null',
    ],
    indexes: ['index (label_id)', 'unique (ticket_id, label_id)'],
    foreignKeys: [
      'label_id -> labels.id on delete cascade',
      'ticket_id -> tickets.id on delete cascade',
    ],
  },
};

describe('migrations on SQLite and on Postgres', () => {
  it('build the same schema at every step', async () => {
    const sqlite = await withDatabase('sqlite', (db) => stepThrough(db, 'sqlite'));
    const postgres = await withDatabase('pglite', (db) => stepThrough(db, 'pglite'));
    expect(postgres).toEqual(sqlite);
  });

  it.each(DIALECTS)('build the data model the architecture describes (%s)', async (dialect) => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      expect(await portableSchema(db, dialect)).toEqual(DATA_MODEL);
    });
  });
});
