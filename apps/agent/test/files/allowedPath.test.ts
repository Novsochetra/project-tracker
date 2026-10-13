import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { allowedRealPath, attachFolders } from '../../src/files/allowedPath';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'attach-path-')));
const work = join(root, 'work');
const home = join(root, 'home');
const secrets = join(home, '.ssh');
mkdirSync(join(work, 'out'), { recursive: true });
mkdirSync(secrets, { recursive: true });
mkdirSync(join(root, 'work-two'));
writeFileSync(join(work, 'out', 'notes.md'), '# Notes');
writeFileSync(join(secrets, 'id_rsa.md'), 'secret');
writeFileSync(join(root, 'work-two', 'notes.md'), 'next door');
symlinkSync(secrets, join(work, 'ssh'));
symlinkSync(join(secrets, 'id_rsa.md'), join(work, 'key.md'));
symlinkSync(join(work, 'out', 'notes.md'), join(work, 'link.md'));

afterAll(() => rmSync(root, { recursive: true, force: true }));

const refusal = (path: string) =>
  `Can't attach ${path}: only files in this folder or a temp folder can be attached (${work}).`;

describe('allowedRealPath', () => {
  it('takes a file anywhere under an allowed folder, by its real path', async () => {
    await expect(allowedRealPath(join(work, 'out', 'notes.md'), [work])).resolves.toBe(
      join(work, 'out', 'notes.md'),
    );
    await expect(allowedRealPath(join(work, 'link.md'), [work])).resolves.toBe(
      join(work, 'out', 'notes.md'),
    );
  });

  it('refuses a symlink in the folder that points outside it', async () => {
    const key = join(work, 'key.md');
    await expect(allowedRealPath(key, [work])).rejects.toThrow(refusal(key));
    const throughFolder = join(work, 'ssh', 'id_rsa.md');
    await expect(allowedRealPath(throughFolder, [work])).rejects.toThrow(refusal(throughFolder));
  });

  it('refuses a way out with ..', async () => {
    const escape = join(work, 'out', '..', '..', 'home', '.ssh', 'id_rsa.md');
    await expect(allowedRealPath(escape, [work])).rejects.toThrow(refusal(escape));
    const relative = `${work}/../home/.ssh/id_rsa.md`;
    await expect(allowedRealPath(relative, [work])).rejects.toThrow(refusal(relative));
  });

  it('refuses a folder whose name only starts like an allowed one, and the folder itself', async () => {
    const nextDoor = join(root, 'work-two', 'notes.md');
    await expect(allowedRealPath(nextDoor, [work])).rejects.toThrow(refusal(nextDoor));
    await expect(allowedRealPath(work, [work])).rejects.toThrow(refusal(work));
  });

  it('says when there is no file', async () => {
    const missing = join(work, 'missing.md');
    await expect(allowedRealPath(missing, [work])).rejects.toThrow(
      `There is no file at ${missing}.`,
    );
  });

  it('finds a folder given through a symlink, like the Mac temp folder', async () => {
    const linkedWork = join(root, 'linked-work');
    symlinkSync(work, linkedWork);
    await expect(allowedRealPath(join(linkedWork, 'out', 'notes.md'), [linkedWork])).resolves.toBe(
      join(work, 'out', 'notes.md'),
    );
  });

  it('refuses everything through a current folder that is the home folder or above it', async () => {
    const file = join(home, 'notes.md');
    writeFileSync(file, 'home');
    const refusedIn = (folder: string) =>
      `Can't attach ${file}: Claude Code runs in ${folder}, which holds your home folder, so only ` +
      'files in a temp folder can be attached. Start it in a project folder instead.';
    for (const folder of [home, root, '/']) {
      await expect(allowedRealPath(file, [folder], home)).rejects.toThrow(refusedIn(folder));
    }
  });

  it('still takes a temp file when the current folder holds the home folder', async () => {
    const file = join(work, 'out', 'notes.md');
    await expect(allowedRealPath(file, [root, work], home)).resolves.toBe(file);
  });

  it('refuses a file in a dot-folder under the current folder', async () => {
    const dotFile = (folder: string) => {
      mkdirSync(join(work, folder), { recursive: true });
      writeFileSync(join(work, folder, 'config.json'), '{}');
      return join(work, folder, 'config.json');
    };
    for (const folder of ['.ssh', '.aws', '.config/gh', 'out/.docker']) {
      const file = dotFile(folder);
      await expect(allowedRealPath(file, [work], home)).rejects.toThrow(
        `Can't attach ${file}: it is in a folder whose name starts with a dot, where keys and ` +
          'settings are kept.',
      );
    }
  });

  it('takes a file from a current folder that is itself inside a dot-folder', async () => {
    const project = join(root, '.config', 'project');
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, 'notes.md'), 'mine');
    await expect(allowedRealPath(join(project, 'notes.md'), [project], home)).resolves.toBe(
      join(project, 'notes.md'),
    );
  });

  it('takes a dot-file that is not in a dot-folder', async () => {
    writeFileSync(join(work, '.notes.md'), 'hidden');
    await expect(allowedRealPath(join(work, '.notes.md'), [work], home)).resolves.toBe(
      join(work, '.notes.md'),
    );
  });

  it('allows the current folder and the temp folders', () => {
    expect(attachFolders()).toEqual([process.cwd(), tmpdir(), '/tmp']);
  });
});
