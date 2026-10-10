import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = `#!/usr/bin/env node
if (process.argv[2] === '--version') { console.log('9.9.9 (fake)'); process.exit(0); }
let prompt = '';
process.stdin.on('data', (chunk) => { prompt += chunk; });
process.stdin.on('end', () => {
  console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));
  console.log('CWD ' + process.cwd());
  console.log('PROMPT ' + prompt);
  if (prompt.includes('TWO LINES')) {
    process.stderr.write('first line\\n');
    setTimeout(() => { process.stderr.write('second line\\n'); process.exit(4); }, 100);
    return;
  }
  if (prompt.includes('FAIL')) { console.error('boom'); process.exit(3); }
  if (prompt.includes('WAIT')) setTimeout(() => process.exit(0), 60000);
});
`;

export function installFakeClaude(): { command: string; dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const command = join(dir, 'claude');
  writeFileSync(command, SCRIPT);
  chmodSync(command, 0o755);
  return { command, dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
