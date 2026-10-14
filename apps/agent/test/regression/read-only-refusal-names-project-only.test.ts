import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { allowedRealPath, attachFolders } from '../../src/files/allowedPath';

// PT-233 review: Ask and Plan take the project folder only, yet a refusal still said a temp
// folder would do.
const home = realpathSync(mkdtempSync(join(tmpdir(), 'refusal-home-')));
const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'refusal-elsewhere-')));
mkdirSync(join(home, 'project'));
writeFileSync(join(elsewhere, 'a.png'), 'x');
writeFileSync(join(home, 'b.png'), 'x');

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(elsewhere, { recursive: true, force: true });
});

const refusal = (path: string, folders: string[]) =>
  allowedRealPath(path, folders, home).then(
    () => '',
    (error: Error) => error.message,
  );

describe('a refusal for the project folder only', () => {
  it('names no temp folder for a file outside it', async () => {
    const project = join(home, 'project');
    const message = await refusal(join(elsewhere, 'a.png'), [project]);
    expect(message).toContain('only files in this folder can be attached');
    expect(message).not.toContain('temp folder');
  });

  it('names no temp folder when Claude Code runs in the home folder', async () => {
    const message = await refusal(join(home, 'b.png'), [home]);
    expect(message).toContain('which holds your home folder, so no file can be attached');
    expect(message).not.toContain('temp folder');
  });

  it('still offers a temp folder where one is allowed', async () => {
    const message = await refusal(join(home, 'b.png'), attachFolders(home));
    expect(message).toContain('only files in a temp folder can be attached');
  });
});
