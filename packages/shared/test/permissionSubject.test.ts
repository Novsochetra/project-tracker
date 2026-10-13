import { describe, expect, it } from 'vitest';
import { permissionSubject } from '../src/logic/permissionSubject';

describe('permissionSubject', () => {
  it('keeps a command’s program, and the subcommand of tools that have them', () => {
    expect(permissionSubject('Run git push origin main')).toBe('run git push');
    expect(permissionSubject('Run npm run verify')).toBe('run npm run');
    expect(permissionSubject('Run /usr/bin/mysql -u root mydb')).toBe('run mysql');
    expect(permissionSubject('Run ./scripts/deploy.sh prod')).toBe('run deploy.sh');
    expect(permissionSubject('Run git --no-pager log')).toBe('run git');
    expect(permissionSubject('Run git Hunter2')).toBe('run git');
    expect(permissionSubject('Run echo hunter2')).toBe('run echo');
  });

  it('shows no command that starts with something that is not a plain program', () => {
    for (const command of ['TOKEN=abc123 npm test', '"$(cat key)" go', '$TOOL run', '(cd x)']) {
      expect(permissionSubject(`Run ${command}`)).toBeNull();
    }
    expect(permissionSubject('Run')).toBeNull();
  });

  it('keeps the path of a file Claude reads, edits or writes, never what it writes', () => {
    expect(permissionSubject('Edit src/a.ts\n- password: x\n+ password: y')).toBe('edit src/a.ts');
    expect(permissionSubject('Write .env\n+ TOKEN=abc')).toBe('write .env');
    expect(permissionSubject('Read ~/notes.md')).toBe('read ~/notes.md');
  });

  it('keeps a fetched address’s host only', () => {
    expect(permissionSubject('Fetch https://me:pw@api.example.com/x?token=abc')).toBe(
      'fetch api.example.com',
    );
    expect(permissionSubject('Fetch not a url')).toBeNull();
  });

  it('keeps an MCP call’s tool, never its arguments', () => {
    expect(permissionSubject('Use github: merge_pull_request\nowner: octo')).toBe(
      'use github: merge_pull_request',
    );
  });

  it('shows nothing of any other label, which can hold a search for a secret', () => {
    expect(permissionSubject("Search for 'hunter2' in src")).toBeNull();
    expect(permissionSubject("Search the web for 'x'")).toBeNull();
    expect(permissionSubject('Use the skill deploy')).toBeNull();
  });
});
