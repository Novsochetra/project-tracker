import { firstLine } from './ownerArgs';

const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['\u007f', '\b']);
const CTRL_C = '\u0003';
const CTRL_D = '\u0004';

async function readAll(input: NodeJS.ReadStream): Promise<string> {
  let text = '';
  for await (const chunk of input) text += String(chunk);
  return text;
}

// Raw mode, so the terminal doesn't echo what is typed.
function askHidden(prompt: string, input: NodeJS.ReadStream, output: NodeJS.WriteStream) {
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
        if (char === CTRL_C || char === CTRL_D) return finish(new Error('Cancelled.'));
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

export async function readPassword(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stderr,
): Promise<string> {
  if (!input.isTTY) return firstLine(await readAll(input));
  const password = await askHidden('Password: ', input, output);
  const again = await askHidden('Password again: ', input, output);
  if (password !== again) throw new Error('The two passwords are not the same.');
  return password;
}
