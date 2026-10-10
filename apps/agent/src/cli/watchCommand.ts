import { trackerUrl } from '../config';
import { describeError } from '../errors';
import { watch, type WatchIo } from '../watch/command';
import { UsageError, type ParsedArgs } from './args';
import { EXIT_ERROR, EXIT_OK } from './exitCodes';
import type { CliIo } from './run';

export const WATCH_USAGE = 'watch [PROJECT] [--name NAME] [--permission-mode MODE]';

const WATCH_OPTIONS = new Set(['name', 'permission-mode']);

const untilSignal = (): Promise<void> =>
  new Promise((resolve) => {
    process.once('SIGINT', () => resolve());
    process.once('SIGTERM', () => resolve());
  });

export function checkWatchArgs(parsed: ParsedArgs): void {
  if (parsed.args.length > 1) {
    throw new UsageError(`Unexpected argument "${parsed.args[1]}".`, WATCH_USAGE);
  }
  const unknown = Object.keys(parsed.options).find((name) => !WATCH_OPTIONS.has(name));
  if (unknown) throw new UsageError(`"watch" has no --${unknown} option.`, WATCH_USAGE);
}

export async function watchCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  const watchIo: WatchIo = {
    env: io.env,
    store: io.store,
    stdout: (text) => io.stdout(text),
    cwd: io.cwd ?? process.cwd(),
    write: io.write ?? ((text) => process.stdout.write(text)),
    untilStopped: io.untilStopped ?? untilSignal,
  };
  const args = {
    project: parsed.args[0],
    name: parsed.options.name,
    permissionMode: parsed.options['permission-mode'],
  };
  try {
    await watch(parsed.global, args, watchIo);
    return EXIT_OK;
  } catch (error) {
    const url = trackerUrl(io.env, parsed.global, io.store.read());
    io.stderr(`Error: ${describeError(error, { trackerUrl: url })}`);
    return EXIT_ERROR;
  }
}
