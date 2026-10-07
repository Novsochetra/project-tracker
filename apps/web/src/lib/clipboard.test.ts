import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIPBOARD_MESSAGES, copyText, readClipboardText } from './clipboard';

function setClipboard(value: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

function setExecCommand(result: boolean | Error) {
  const execCommand = vi.fn(() => {
    if (result instanceof Error) throw result;
    return result;
  });
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  return execCommand;
}

function promptBox(text: string): HTMLTextAreaElement {
  const box = document.createElement('textarea');
  box.value = text;
  document.body.append(box);
  return box;
}

describe('copyText', () => {
  beforeEach(() => {
    setExecCommand(false);
  });

  afterEach(() => {
    setClipboard(undefined);
    document.body.innerHTML = '';
  });

  it('uses the Clipboard API when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const execCommand = setExecCommand(true);
    await expect(copyText('Prompt', promptBox('Prompt'))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Prompt');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('selects the textarea and runs the copy command when the Clipboard API fails', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const execCommand = setExecCommand(true);
    const box = promptBox('Prompt text');
    await expect(copyText('Prompt text', box)).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(box);
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, 'Prompt text'.length]);
    expect(box.readOnly).toBe(false);
  });

  it('returns false when both ways fail', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExecCommand(false);
    await expect(copyText('Prompt', promptBox('Prompt'))).resolves.toBe(false);
    setExecCommand(new Error('not supported'));
    await expect(copyText('Prompt', promptBox('Prompt'))).resolves.toBe(false);
  });

  it('copies through a temporary field when there is no Clipboard API and no textarea', async () => {
    let copied = '';
    const execCommand = vi.fn(() => {
      const field = document.activeElement as HTMLTextAreaElement;
      copied = field.value.slice(field.selectionStart, field.selectionEnd);
      return true;
    });
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    await expect(copyText('claude mcp add tracker')).resolves.toBe(true);
    expect(copied).toBe('claude mcp add tracker');
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('readClipboardText', () => {
  afterEach(() => {
    setClipboard(undefined);
  });

  it('returns the clipboard text', async () => {
    setClipboard({ readText: vi.fn().mockResolvedValue('TICKET: MOB-1') });
    await expect(readClipboardText()).resolves.toEqual({ ok: true, text: 'TICKET: MOB-1' });
  });

  it('reports an empty clipboard', async () => {
    setClipboard({ readText: vi.fn().mockResolvedValue('  \n') });
    await expect(readClipboardText()).resolves.toEqual({
      ok: false,
      message: 'The clipboard is empty.',
    });
  });

  it('reports refused access', async () => {
    setClipboard({ readText: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) });
    await expect(readClipboardText()).resolves.toEqual({
      ok: false,
      message: 'Clipboard access was blocked. Paste into the box instead.',
    });
  });

  it('reports a missing Clipboard API', async () => {
    setClipboard(undefined);
    await expect(readClipboardText()).resolves.toEqual({
      ok: false,
      message: 'Clipboard access isn’t available here. Paste into the box instead.',
    });
    setClipboard({
      readText: () => {
        throw new Error('not here');
      },
    });
    await expect(readClipboardText()).resolves.toEqual({
      ok: false,
      message: CLIPBOARD_MESSAGES.unavailable,
    });
  });
});
