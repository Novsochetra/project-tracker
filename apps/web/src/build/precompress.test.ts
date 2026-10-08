import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { isTextFile, precompressFolder } from './precompress';

const SCRIPT = `export const answer = ${JSON.stringify('forty-two '.repeat(200))};\n`;

describe('precompress', () => {
  const folders: string[] = [];
  const newFolder = () => {
    const folder = mkdtempSync(join(tmpdir(), 'tracker-precompress-'));
    folders.push(folder);
    return folder;
  };

  afterEach(() => {
    folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
  });

  it('picks the text files of a build', () => {
    for (const name of ['index.html', 'sw.js', 'a-1.css', 'favicon.svg', 'manifest.webmanifest']) {
      expect(isTextFile(name), name).toBe(true);
    }
    for (const name of ['icon.png', 'geist.woff2', 'clip.mp4', 'a-1.js.br', 'a-1.js.gz']) {
      expect(isTextFile(name), name).toBe(false);
    }
  });

  it('writes .br and .gz copies that decode to each text file, in subfolders too', async () => {
    const folder = newFolder();
    mkdirSync(join(folder, 'assets'));
    const script = join(folder, 'assets', 'app-1.js');
    writeFileSync(script, SCRIPT);
    writeFileSync(join(folder, 'icon.png'), SCRIPT);

    await precompressFolder(folder);

    expect(brotliDecompressSync(readFileSync(`${script}.br`)).toString()).toBe(SCRIPT);
    expect(gunzipSync(readFileSync(`${script}.gz`)).toString()).toBe(SCRIPT);
    expect(readFileSync(`${script}.br`).length).toBeLessThan(readFileSync(`${script}.gz`).length);
    expect(existsSync(join(folder, 'icon.png.br'))).toBe(false);
    expect(existsSync(join(folder, 'icon.png.gz'))).toBe(false);
  });

  it('leaves out a copy that would not be smaller', async () => {
    const folder = newFolder();
    writeFileSync(join(folder, 'tiny.js'), 'x');
    await precompressFolder(folder);
    expect(existsSync(join(folder, 'tiny.js.br'))).toBe(false);
    expect(existsSync(join(folder, 'tiny.js.gz'))).toBe(false);
  });
});
