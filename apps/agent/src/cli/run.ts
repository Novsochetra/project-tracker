import { createTrackerClient, type TrackerApi } from '../client';
import { loadConfig, type Config, type Env } from '../config';
import { describeError } from '../errors';
import { parseCliArgs, prepareCommand, UsageError, type ParsedArgs, type Prepared } from './args';
import { USAGE } from './usage';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;

export interface CliIo {
  env: Env;
  stdout(text: string): void;
  stderr(text: string): void;
  connect?: (config: Config) => TrackerApi;
}

function usageErrorText(error: UsageError): string {
  const hint = error.usage ? `Usage: tracker ${error.usage}` : 'Run "tracker help" for usage.';
  return `${error.message}\n${hint}`;
}

async function execute(prepared: Prepared, parsed: ParsedArgs, io: CliIo): Promise<number> {
  const config = loadConfig(io.env, parsed.global);
  const client = (io.connect ?? createTrackerClient)(config);
  try {
    const reply = await prepared.tool.handler(client, prepared.input);
    io.stdout(parsed.global.json ? JSON.stringify(reply.data, null, 2) : reply.text);
    return EXIT_OK;
  } catch (error) {
    io.stderr(`Error: ${describeError(error)}`);
    return EXIT_ERROR;
  }
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed: ParsedArgs;
  let prepared: Prepared;
  try {
    parsed = parseCliArgs(argv);
    if (parsed.global.help || parsed.command === 'help') {
      io.stdout(USAGE);
      return EXIT_OK;
    }
    prepared = prepareCommand(parsed);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr(usageErrorText(error));
    return EXIT_USAGE;
  }
  return execute(prepared, parsed, io);
}
