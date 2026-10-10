import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = `#!/usr/bin/env node
if (process.argv[2] === '--version') { console.log('9.9.9 (fake)'); process.exit(0); }
if (process.argv[2] === 'mcp') {
  const state = process.env.FAKE_MCP === 'broken'
    ? '\u2717 Failed to connect'
    : '\u2714 Connected';
  if (process.env.FAKE_MCP === 'unreadable') { console.log('mcp list is not available'); }
  else { console.log('tracker: node /gone/apps/agent/dist/mcp.js - ' + state); }
  process.exit(0);
}
let prompt = '';
process.stdin.on('data', (chunk) => { prompt += chunk; });
process.stdin.on('end', () => {
  if (process.argv.includes('--output-format')) {
    const session_id = '11111111-2222-4333-8444-555555555555';
    const result = 'ARGS ' + JSON.stringify(process.argv.slice(2)) + '\\nPROMPT ' + prompt;
    if (prompt.includes('ASK FAIL')) {
      console.log(JSON.stringify({ is_error: true, result: 'Credit balance is too low', session_id }));
      process.exit(1);
    }
    if (prompt.includes('WAIT')) { setTimeout(() => process.exit(0), 60000); return; }
    console.log(JSON.stringify({ type: 'result', is_error: false, result, session_id }));
    process.exit(0);
  }
  console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));
  console.log('CWD ' + process.cwd());
  console.log('PROMPT ' + prompt);
  if (prompt.includes('SPLIT')) {
    const bytes = Buffer.from('café ✓');
    process.stderr.write(bytes.subarray(0, 4));
    setTimeout(() => { process.stderr.write(bytes.subarray(4)); process.exit(5); }, 100);
    return;
  }
  if (prompt.includes('TWO LINES')) {
    process.stderr.write('first line\\n');
    setTimeout(() => { process.stderr.write('second line\\n'); process.exit(4); }, 100);
    return;
  }
  if (prompt.includes('REPORT')) {
    console.log('Did the work.\\n\\n\u0060\u0060\u0060\\nTICKET: ' + /\\b[A-Z]+-\\d+/.exec(prompt)[0]
      + '\\nSTATUS: done\\nSUMMARY: Fixed it.\\nFILES: a.ts\\nNEXT: none\\n\u0060\u0060\u0060');
    process.exit(0);
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
