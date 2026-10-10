import { createTrackerClient, type TrackerApi } from '../client';
import { loadConfig, type Config, type Env } from '../config';
import type { ConfigStore } from '../configFile';
import { describeError } from '../errors';
import { parseCliArgs, prepareCommand, UsageError, type ParsedArgs, type Prepared } from './args';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE } from './exitCodes';
import { login, logout } from './login';
import { USAGE } from './usage';
import { checkWatchArgs, watchCommand } from './watchCommand';

export { EXIT_ERROR, EXIT_OK, EXIT_USAGE } from './exitCodes';

export interface CliIo {
  env: Env;
  store: ConfigStore;
  stdout(text: string): void;
  stderr(text: string): void;
  readSecret?: (prompt: string) => Promise<string>;
  connect?: (config: Config) => TrackerApi;
  cwd?: string;
  write?: (text: string) => void;
  untilStopped?: () => Promise<void>;
}

const SETUP_COMMANDS = new Set(['login', 'logout']);

function usageErrorText(error: UsageError): string {
  const hint = error.usage ? `Usage: tracker ${error.usage}` : 'Run "tracker help" for usage.';
  return `${error.message}\n${hint}`;
}

async function execute(prepared: Prepared, parsed: ParsedArgs, io: CliIo): Promise<number> {
  let client: TrackerApi | undefined;
  try {
    const config = loadConfig(io.env, parsed.global, io.store.read());
    client = (io.connect ?? createTrackerClient)(config);
    const reply = await prepared.tool.handler(client, prepared.input);
    io.stdout(parsed.global.json ? JSON.stringify(reply.data, null, 2) : reply.text);
    return EXIT_OK;
  } catch (error) {
    io.stderr(`Error: ${describeError(error, client)}`);
    return EXIT_ERROR;
  }
}

function checkSetupArgs(parsed: ParsedArgs): void {
  const usage = `${parsed.command ?? ''} [--url URL]`;
  if (parsed.args.length > 0) {
    throw new UsageError(`Unexpected argument "${parsed.args[0]}".`, usage);
  }
  if (parsed.global.token !== undefined) {
    throw new UsageError(
      'Paste the token when asked, or pipe it in: a --token flag stays in your shell history.',
      usage,
    );
  }
}

async function setup(parsed: ParsedArgs, io: CliIo): Promise<number> {
  const readSecret = io.readSecret ?? (() => Promise.resolve(''));
  try {
    if (parsed.command === 'logout') return logout(parsed.global, { ...io, readSecret });
    return await login(parsed.global, { ...io, readSecret });
  } catch (error) {
    io.stderr(`Error: ${describeError(error)}`);
    return EXIT_ERROR;
  }
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed: ParsedArgs;
  let prepared: Prepared | undefined;
  try {
    parsed = parseCliArgs(argv);
    if (parsed.global.help || parsed.command === 'help') {
      io.stdout(USAGE);
      return EXIT_OK;
    }
    if (SETUP_COMMANDS.has(parsed.command ?? '')) checkSetupArgs(parsed);
    else if (parsed.command === 'watch') checkWatchArgs(parsed);
    else prepared = prepareCommand(parsed);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr(usageErrorText(error));
    return EXIT_USAGE;
  }
  if (prepared) return execute(prepared, parsed, io);
  return parsed.command === 'watch' ? watchCommand(parsed, io) : setup(parsed, io);
}
