import { AutostartError } from '../errors';
import type { HelperJob } from '../job';

const PLAIN_WORD = /^[\w+=:,./@-]+$/;

export const unitNameOf = (label: string): string => `${label}.service`;

// A line break would end the setting and start another one of the value's choosing.
const isControl = (char: string): boolean => char < ' ' || char === '\u007f';

function oneLine(text: string): string {
  if ([...text].some(isControl)) {
    throw new AutostartError(`${JSON.stringify(text)} has a line break or control character.`);
  }
  return text;
}

// systemd reads %x as a specifier everywhere, and $NAME as a variable in ExecStart.
const literal = (text: string): string => oneLine(text).replaceAll('%', '%%');

const quoted = (text: string): string =>
  `"${literal(text).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

const execWord = (word: string): string =>
  PLAIN_WORD.test(word) ? word : quoted(word).replaceAll('$', '$$$$');

export function systemdUnit(job: HelperJob): string {
  const environment = Object.entries(job.environment).map(
    ([key, value]) => `Environment=${quoted(`${key}=${value}`)}`,
  );
  return [
    '[Unit]',
    `Description=tracker watch in ${literal(job.folder)}`,
    '',
    '[Service]',
    `WorkingDirectory=${literal(job.folder)}`,
    ...environment,
    `ExecStart=${job.program.map(execWord).join(' ')}`,
    // Only after a crash: a helper that stops cleanly was stopped on purpose.
    'Restart=on-failure',
    'RestartSec=120',
    // SIGTERM to the helper alone, so it stops Claude itself and reports the run cancelled.
    'KillMode=mixed',
    'StandardOutput=journal',
    'StandardError=journal',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

const unescape = (word: string): string => word.replaceAll('%%', '%').replaceAll('$$', '$');

export function unitUrl(unit: string): string | undefined {
  const execStart = /^ExecStart=(.*)$/m.exec(unit)?.[1] ?? '';
  const url = /(?:^|\s)"?--url=([^\s"]+)/.exec(execStart)?.[1];
  return url === undefined ? undefined : unescape(url);
}
