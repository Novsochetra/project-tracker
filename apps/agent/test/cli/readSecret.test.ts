import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readSecret, type SecretInput } from '../../src/cli/readSecret';

function fakeTerminal() {
  const emitter = new EventEmitter();
  const modes: boolean[] = [];
  const terminal = Object.assign(emitter, {
    isTTY: true,
    setRawMode: (mode: boolean) => {
      modes.push(mode);
      return terminal;
    },
    resume: () => terminal,
    pause: () => terminal,
    [Symbol.asyncIterator]: () => {
      throw new Error('A terminal is read key by key.');
    },
  });
  return { terminal: terminal as unknown as SecretInput, emitter, modes };
}

describe('readSecret', () => {
  it('reads the first line of a pipe', async () => {
    const piped = Readable.from(['trk_abc\nmore\n']) as unknown as SecretInput;
    expect(await readSecret('Token: ', piped, { write: () => true })).toBe('trk_abc');
  });

  it('reads a terminal without echoing, with backspace, until Return', async () => {
    const { terminal, emitter, modes } = fakeTerminal();
    const written: string[] = [];
    const output = { write: (text: string) => written.push(text) > 0 };
    const answer = readSecret('Token: ', terminal, output);
    emitter.emit('data', Buffer.from('trk_abx'));
    emitter.emit('data', Buffer.from('\u007fc\r'));
    expect(await answer).toBe('trk_abc');
    expect(written).toEqual(['Token: ', '\n']);
    expect(modes).toEqual([true, false]);
  });

  it('stops on Ctrl-C', async () => {
    const { terminal, emitter, modes } = fakeTerminal();
    const answer = readSecret('Token: ', terminal, { write: () => true });
    emitter.emit('data', Buffer.from('trk\u0003'));
    await expect(answer).rejects.toThrow('Cancelled.');
    expect(modes).toEqual([true, false]);
  });
});
