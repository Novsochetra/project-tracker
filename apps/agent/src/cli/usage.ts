import { DEFAULT_AGENT_NAME, DEFAULT_URL } from '../config';
import { COMMANDS } from './commands';
import { WATCH_USAGE } from './watchCommand';

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
  ['--version', 'Print the version of this CLI'],
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
  'Run Claude Code from your phone:',
  `  ${WATCH_USAGE}`,
  '      Run this in your code folder and leave it open. "Run in Claude Code" in the app',
  '      starts claude -p here. PROJECT defaults to the project whose repo is this folder.',
  "      --name names this computer in the app (default: this computer's name). --permission-mode",
  '      is passed to claude for ticket runs and Edit questions. Without it, your own Claude',
  '      Code settings decide for a ticket run, and an Edit question asks on the phone before',
  '      each step (default). Ask and Plan questions are always read-only.',
  '      --max-turns N passes the same to claude for every run and question, so none goes on',
  '      past N turns; one that reaches it stops, and the app says so.',
  '      --approvals makes ticket runs ask on the phone before each step too; use it with',
  '      --permission-mode acceptEdits; auto, bypassPermissions and dontAsk are refused with it.',
  '      It keeps the Mac from idle sleep while it runs (--no-keep-awake turns that off).',
  '      --install makes it start by itself (at login on macOS, at boot on Linux), --uninstall',
  '      stops that, and --check says whether it is installed, running and online.',
  '',
  'Global options:',
  ...GLOBAL_HELP.map(([flag, text]) => `  ${flag.padEnd(16)}${text}`),
  '',
  'Examples:',
  '  tracker login --url https://tracker.example.com',
  '  tracker tickets MOB --status "In progress"',
  '  tracker claim MOB',
  '  tracker move MOB-3 In progress',
  '  tracker attach MOB-3 notes.md data.csv --comment "The draft and its numbers"',
  '  tracker submit MOB-3 --summary "Fixed the crash; tests pass" --files src/profile.ts --next none',
  '  tracker review MOB-3 --verdict approved --rating 5 --summary "Works and is tested"',
].join('\n');
