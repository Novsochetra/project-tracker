import { DEFAULT_AGENT_NAME, DEFAULT_URL } from '../config';
import { COMMANDS } from './commands';

const GLOBAL_HELP: readonly (readonly [string, string])[] = [
  [
    '--url URL',
    `Tracker URL (env TRACKER_URL, else the one you logged in to, else ${DEFAULT_URL})`,
  ],
  [
    '--as NAME',
    `Agent name shown in activity (env TRACKER_AGENT_NAME, default ${DEFAULT_AGENT_NAME})`,
  ],
  ['--token TOKEN', 'API token (env TRACKER_API_TOKEN, else the one saved by login)'],
  ['--json', 'Print the raw JSON response instead of text'],
  ['-h, --help', 'Show this help'],
];

const SETUP_HELP: readonly (readonly [string, string])[] = [
  [
    'login [--url URL]',
    'Save an API token for this tracker (asks for it; or pipe it in). Create one in the app: Connect Claude Code.',
  ],
  ['logout [--url URL]', 'Forget the saved token for this tracker.'],
];

export const USAGE = [
  'Usage: tracker <command> [options]',
  '',
  'Commands:',
  ...COMMANDS.flatMap((command) => [`  ${command.usage}`, `      ${command.summary}`]),
  '  help',
  '      Show this help.',
  '',
  'Setup:',
  ...SETUP_HELP.flatMap(([usage, summary]) => [`  ${usage}`, `      ${summary}`]),
  '  Tokens are saved in ~/.config/project-tracker/config.json, which only you can read',
  '  (TRACKER_CONFIG moves it). The MCP server reads it too.',
  '',
  'Global options:',
  ...GLOBAL_HELP.map(([flag, text]) => `  ${flag.padEnd(16)}${text}`),
  '',
  'Examples:',
  '  tracker login --url https://tracker.example.com',
  '  tracker tickets MOB --status "In progress"',
  '  tracker claim MOB',
  '  tracker move MOB-3 In progress',
  '  tracker submit MOB-3 --summary "Fixed the crash; tests pass" --files src/profile.ts --next none',
  '  tracker review MOB-3 --verdict approved --rating 5 --summary "Works and is tested"',
].join('\n');
