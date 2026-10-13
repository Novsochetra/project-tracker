import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { Attachment } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  addDirArgs,
  ASK_FOLDER_PREFIX,
  withAskFiles,
  type FetchFile,
} from '../../../src/watch/ask/askFiles';

const file = (id: string, fileName: string): Attachment => ({
  id,
  ticketId: null,
  activityId: null,
  fileName,
  mimeType: 'text/plain',
  size: 5,
  width: null,
  height: null,
  url: `/api/attachments/${id}/file`,
  createdAt: 1,
});

const FILES = [file('f1', 'board.jpg'), file('f2', '../notes.txt')];

const fetchFile: FetchFile = (id) => Promise.resolve(new Response(`bytes of ${id}`));

const running = () => new AbortController().signal;

// The run's folder, found by the first file in it, for a test that never gets to see it.
const foldersWithBoard = () =>
  readdirSync(tmpdir())
    .filter((name) => name.startsWith(ASK_FOLDER_PREFIX))
    .map((name) => join(tmpdir(), name))
    .filter((dir) => existsSync(join(dir, 'board.jpg')));

describe('withAskFiles', () => {
  it('runs a question without files with no folder', async () => {
    const folder = await withAskFiles(undefined, { job: {}, stop: running() }, (got) =>
      Promise.resolve(got),
    );
    expect(folder).toBeNull();
    expect(addDirArgs(null)).toEqual([]);
  });

  it('puts the files in a folder of their own while Claude runs, then removes it', async () => {
    let seen: { dir: string; contents: string[]; names: string[] } | undefined;
    const answer = await withAskFiles(
      fetchFile,
      { job: { files: FILES }, stop: running() },
      (got) => {
        seen = {
          dir: got!.dir,
          contents: got!.paths.map((path) => readFileSync(path, 'utf8')),
          names: got!.paths.map((path) => basename(path)),
        };
        expect(got!.paths.every((path) => dirname(path) === got!.dir)).toBe(true);
        expect(addDirArgs(got)).toEqual(['--add-dir', got!.dir]);
        return Promise.resolve('Two tickets.');
      },
    );
    expect(answer).toBe('Two tickets.');
    expect(seen?.contents).toEqual(['bytes of f1', 'bytes of f2']);
    expect(seen?.names).toEqual(['board.jpg', '_notes.txt']);
    expect(existsSync(seen!.dir)).toBe(false);
  });

  it('removes the folder when Claude fails', async () => {
    let dir = '';
    const failing = withAskFiles(fetchFile, { job: { files: FILES }, stop: running() }, (got) => {
      dir = got!.dir;
      return Promise.reject(new Error('Claude Code exited with 1.'));
    });
    await expect(failing).rejects.toThrow('Claude Code exited with 1.');
    expect(dir).not.toBe('');
    expect(existsSync(dir)).toBe(false);
  });

  it('says which file the tracker would not give, and removes what it got', async () => {
    const dirs: string[] = [];
    const halfway: FetchFile = (id) => {
      if (id === 'f1') return fetchFile(id);
      dirs.push(...foldersWithBoard());
      return Promise.reject(new Error('Attachment was not found.'));
    };
    let ran = false;
    const failing = withAskFiles(halfway, { job: { files: FILES }, stop: running() }, () => {
      ran = true;
      return Promise.resolve();
    });
    await expect(failing).rejects.toThrow(
      "Couldn't get ../notes.txt from the tracker: Attachment was not found.",
    );
    expect(ran).toBe(false);
    expect(dirs).toHaveLength(1);
    for (const dir of dirs) expect(existsSync(dir)).toBe(false);
  });

  it('stops downloading when the question is stopped, and removes the folder', async () => {
    const stop = new AbortController();
    const asked: string[] = [];
    const stopping: FetchFile = (id) => {
      stop.abort();
      asked.push(id);
      return fetchFile(id);
    };
    let ran = false;
    const stopped = withAskFiles(stopping, { job: { files: FILES }, stop: stop.signal }, () => {
      ran = true;
      return Promise.resolve();
    });
    await expect(stopped).rejects.toThrow();
    expect(asked).toEqual(['f1']);
    expect(ran).toBe(false);
    expect(foldersWithBoard()).toEqual([]);
  });

  it("refuses files when this helper can't download them", async () => {
    await expect(
      withAskFiles(undefined, { job: { files: FILES }, stop: running() }, () => Promise.resolve()),
    ).rejects.toThrow("This helper can't download the question's files.");
  });
});
