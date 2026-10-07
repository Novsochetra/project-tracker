import { DEFAULT_AGENT_NAME, DEFAULT_URL } from '../config';
import { COMMANDS } from './commands';

const GLOBAL_HELP: readonly (readonly [string, string])[] = [
  ['--url URL', `Tracker URL (env TRACKER_URL, default ${DEFAULT_URL})`],
  [
    '--as NAME',
    `Agent name shown in activity (env TRACKER_AGENT_NAME, default ${DEFAULT_AGENT_NAME})`,
  ],
  ['--token TOKEN', 'Access token (env TRACKER_TOKEN)'],
  ['--json', 'Print the raw JSON response instead of text'],
  ['-h, --help', 'Show this help'],
];

export const USAGE = [
  'Usage: tracker <command> [options]',
  '',
  'Commands:',
  ...COMMANDS.flatMap((command) => [`  ${command.usage}`, `      ${command.summary}`]),
  '  help',
  '      Show this help.',
  '',
  'Global options:',
  ...GLOBAL_HELP.map(([flag, text]) => `  ${flag.padEnd(16)}${text}`),
  '',
  'Examples:',
  '  tracker tickets MOB --status "In progress"',
  '  tracker claim MOB',
  '  tracker move MOB-3 In progress',
  '  tracker submit MOB-3 --summary "Fixed the crash; tests pass" --files src/profile.ts --next none',
  '  tracker review MOB-3 --verdict approved --rating 5 --summary "Works and is tested"',
].join('\n');
