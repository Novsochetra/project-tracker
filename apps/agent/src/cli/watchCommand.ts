import { trackerUrl } from '../config';
import { describeError } from '../errors';
import { check } from '../watch/autostart/check';
import { install, uninstall } from '../watch/autostart/install';
import { approvalsProblem } from '../watch/approvals';
import { watch } from '../watch/watch';
import type { WatchArgs, WatchIo } from '../watch/watchIo';
import { UsageError, type ParsedArgs } from './args';
import { ignoreClosedTerminal, stampLines, untilSignal } from './terminal';
import { EXIT_ERROR, EXIT_OK } from './exitCodes';
import type { CliIo } from './run';

export const WATCH_USAGE =
  'watch [PROJECT] [--name NAME] [--permission-mode MODE] [--max-turns N] [--approvals] [--no-keep-awake] [--install | --uninstall | --check]';

const WATCH_OPTIONS = new Set(['name', 'permission-mode', 'max-turns']);

// Digits only, so the value can't be read as another flag.
const TURNS = /^[1-9]\d{0,5}$/;

function connectionOf(parsed: ParsedArgs, io: CliIo) {
  try {
    return { trackerUrl: trackerUrl(io.env, parsed.global, io.store.read()) };
  } catch {
    return {};
  }
}

export function checkWatchArgs(parsed: ParsedArgs): void {
  if (parsed.args.length > 1) {
    throw new UsageError(`Unexpected argument "${parsed.args[1]}".`, WATCH_USAGE);
  }
  const unknown = Object.keys(parsed.options).find((name) => !WATCH_OPTIONS.has(name));
  if (unknown) throw new UsageError(`"watch" has no --${unknown} option.`, WATCH_USAGE);
  const turns = parsed.options['max-turns'];
  if (turns !== undefined && !TURNS.test(turns)) {
    throw new UsageError('Use a whole number of turns for --max-turns, like 50.', WATCH_USAGE);
  }
  const { install: installing, uninstall: removing, check: checking } = parsed.flags;
  if ([installing, removing, checking].filter(Boolean).length > 1) {
    throw new UsageError('Use one of --install, --uninstall and --check.', WATCH_USAGE);
  }
  const choices = parsed.args.length + Object.keys(parsed.options).length;
  const { 'no-keep-awake': noKeepAwake, approvals } = parsed.flags;
  if ((removing || checking) && (choices > 0 || noKeepAwake || approvals)) {
    throw new UsageError(
      `--${removing ? 'uninstall' : 'check'} takes no project or other options: run it in the folder.`,
      WATCH_USAGE,
    );
  }
  const problem = approvalsProblem({
    approvals,
    permissionMode: parsed.options['permission-mode'],
  });
  if (problem) throw new UsageError(problem, WATCH_USAGE);
}

function run(parsed: ParsedArgs, args: WatchArgs, io: WatchIo): Promise<void> {
  if (parsed.flags.install) return install(parsed.global, args, io);
  if (parsed.flags.uninstall) return Promise.resolve(uninstall(io));
  if (parsed.flags.check) return check(parsed.global, io);
  return watch(parsed.global, args, io);
}

// Started at login, the helper writes to a log file, where every line needs its time.
export function lineFormat(
  parsed: ParsedArgs,
  inTerminal = process.stdout.isTTY,
): (text: string) => string {
  const { install: installing, uninstall: removing, check: checking } = parsed.flags;
  const logged = !inTerminal && !installing && !removing && !checking;
  return (text) => (logged ? stampLines(text, new Date()) : text);
}

export async function watchCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  ignoreClosedTerminal(process.stdout);
  ignoreClosedTerminal(process.stderr);
  const line = lineFormat(parsed);
  const watchIo: WatchIo = {
    env: io.env,
    store: io.store,
    stdout: (text) => io.stdout(line(text)),
    cwd: io.cwd ?? process.cwd(),
    write: io.write ?? ((text) => process.stdout.write(text)),
    untilStopped: io.untilStopped ?? untilSignal,
  };
  const args: WatchArgs = {
    project: parsed.args[0],
    name: parsed.options.name,
    permissionMode: parsed.options['permission-mode'],
    maxTurns: parsed.options['max-turns'],
    keepAwake: !parsed.flags['no-keep-awake'],
    approvals: parsed.flags.approvals,
  };
  try {
    await run(parsed, args, watchIo);
    return EXIT_OK;
  } catch (error) {
    io.stderr(line(`Error: ${describeError(error, connectionOf(parsed, io))}`));
    return EXIT_ERROR;
  }
}
