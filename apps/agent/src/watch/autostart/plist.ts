export interface LaunchAgent {
  label: string;
  program: readonly string[];
  folder: string;
  logPath: string;
  environment: Readonly<Record<string, string>>;
}

const escapeXml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const string = (text: string): string => `<string>${escapeXml(text)}</string>`;

const keyed = (entries: readonly (readonly [string, string])[]): string =>
  entries.map(([key, value]) => `<key>${escapeXml(key)}</key>${value}`).join('\n    ');

export function launchAgentPlist(agent: LaunchAgent): string {
  const environment = Object.entries(agent.environment).map(
    ([key, value]) => [key, string(value)] as const,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    ${keyed([
      ['Label', string(agent.label)],
      ['ProgramArguments', `<array>${agent.program.map(string).join('')}</array>`],
      ['WorkingDirectory', string(agent.folder)],
      ['EnvironmentVariables', `<dict>${keyed(environment)}</dict>`],
      ['RunAtLoad', '<true/>'],
      // Only after a crash: a helper that stops cleanly was stopped on purpose, as at logout.
      ['KeepAlive', '<dict><key>SuccessfulExit</key><false/></dict>'],
      ['ThrottleInterval', '<integer>120</integer>'],
      ['StandardOutPath', string(agent.logPath)],
      ['StandardErrorPath', string(agent.logPath)],
    ])}
</dict>
</plist>
`;
}
