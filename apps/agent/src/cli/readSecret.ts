const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['\u007f', '\b']);
const CTRL_C = '\u0003';
const CTRL_D = '\u0004';

export type SecretInput = Pick<
  NodeJS.ReadStream,
  'isTTY' | 'setRawMode' | 'resume' | 'pause' | 'on' | 'off' | typeof Symbol.asyncIterator
>;

export type SecretOutput = Pick<NodeJS.WriteStream, 'write'>;

export class CancelledError extends Error {
  override name = 'CancelledError';
}

async function firstLineOf(input: SecretInput): Promise<string> {
  let text = '';
  for await (const chunk of input) {
    text += String(chunk);
    if (/\r?\n/.test(text)) break;
  }
  return text.split(/\r?\n/)[0] ?? '';
}

// Raw mode, so the terminal doesn't echo the token onto the screen or into its scrollback.
function askHidden(prompt: string, input: SecretInput, output: SecretOutput) {
  return new Promise<string>((resolve, reject) => {
    let typed = '';
    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.off('data', onData);
      output.write('\n');
      if (error) reject(error);
      else resolve(typed);
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === CTRL_C || char === CTRL_D) return finish(new CancelledError('Cancelled.'));
        if (ENTER.has(char)) return finish();
        typed = BACKSPACE.has(char) ? typed.slice(0, -1) : typed + char;
      }
    };
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

// Typed hidden at a terminal, or the first line of a pipe (`pbpaste | tracker login`).
export async function readSecret(
  prompt: string,
  input: SecretInput = process.stdin,
  output: SecretOutput = process.stderr,
): Promise<string> {
  return input.isTTY ? askHidden(prompt, input, output) : firstLineOf(input);
}
