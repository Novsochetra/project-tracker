import { parseArgs } from 'node:util';
import type { z } from 'zod';
import type { Tool } from '../tools/tool';
import { findCommand, type Command, type Plan } from './commands';
import {
  COMMAND_OPTIONS,
  GLOBAL_OPTIONS,
  WATCH_FLAGS,
  type CommandOption,
  type CommandValues,
  type GlobalValues,
  type WatchFlags,
} from './options';

export class UsageError extends Error {
  override name = 'UsageError';

  constructor(
    message: string,
    readonly usage?: string,
  ) {
    super(message);
  }
}

export interface ParsedArgs {
  command: string | undefined;
  args: string[];
  global: GlobalValues;
  options: CommandValues;
  flags: WatchFlags;
}

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: { ...GLOBAL_OPTIONS, ...COMMAND_OPTIONS, ...WATCH_FLAGS },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const { url, as, token, json = false, help = false, ...rest } = parsed.values;
  const { install, uninstall, check, 'no-keep-awake': noKeepAwake, ...options } = rest;
  const flags = Object.fromEntries(
    Object.entries({ install, uninstall, check, 'no-keep-awake': noKeepAwake }).filter(
      ([, value]) => value !== undefined,
    ),
  ) as WatchFlags;
  const [command, ...args] = parsed.positionals;
  return { command, args, global: { url, as, token, json, help }, options, flags };
}

function checkArgs(command: Command, parsed: ParsedArgs): void {
  const fail = (message: string) => {
    throw new UsageError(message, command.usage);
  };
  const names = [...Object.keys(parsed.options), ...Object.keys(parsed.flags)] as CommandOption[];
  const unknown = names.find((name) => !command.options.includes(name));
  if (unknown) fail(`"${command.name}" has no --${unknown} option.`);
  const missingArg = command.args[parsed.args.length];
  if (missingArg) fail(`Missing <${missingArg}>.`);
  const extra = parsed.args[command.args.length];
  if (extra !== undefined && !command.rest) fail(`Unexpected argument "${extra}".`);
  const missingOption = command.required?.find((name) => parsed.options[name] === undefined);
  if (missingOption) fail(`Missing --${missingOption}.`);
}

const formatIssue = (issue: z.core.$ZodIssue): string =>
  issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message;

export interface Prepared {
  tool: Tool;
  input: z.output<z.ZodObject>;
}

function validate(plan: Plan, command: Command): Prepared {
  const result = plan.tool.input.safeParse(plan.input);
  if (!result.success) {
    throw new UsageError(result.error.issues.map(formatIssue).join('\n'), command.usage);
  }
  return { tool: plan.tool, input: result.data };
}

export function prepareCommand(parsed: ParsedArgs): Prepared {
  if (!parsed.command) throw new UsageError('Missing command.');
  const command = findCommand(parsed.command);
  if (!command) throw new UsageError(`Unknown command "${parsed.command}".`);
  checkArgs(command, parsed);
  return validate(command.plan(parsed.args, parsed.options), command);
}
