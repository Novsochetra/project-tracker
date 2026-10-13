import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = `#!/usr/bin/env node
if (process.argv[2] === '--version') { console.log('9.9.9 (fake)'); process.exit(0); }
if (process.argv[2] === 'mcp') {
  // Leaves its process id beside itself, so a test can see whether a stop ended it.
  if (process.env.FAKE_MCP === 'slow') {
    const { writeFileSync } = require('node:fs');
    const { dirname, join } = require('node:path');
    writeFileSync(join(dirname(process.argv[1]), 'mcp-list.pid'), String(process.pid));
    setTimeout(() => process.exit(0), 60000);
    return;
  }
  const state = process.env.FAKE_MCP === 'broken'
    ? '\u2717 Failed to connect'
    : '\u2714 Connected';
  if (process.env.FAKE_MCP === 'unreadable') { console.log('mcp list is not available'); }
  else {
    console.log('claude.ai Notion: https://mcp.notion.com/mcp - \u2714 Connected');
    console.log('tracker: node /gone/apps/agent/dist/mcp.js - ' + state);
  }
  process.exit(0);
}
const { existsSync } = require('node:fs');
const { dirname, join } = require('node:path');
const stream = process.argv.includes('stream-json');
const session_id = '11111111-2222-4333-8444-555555555555';
const emit = (event) => console.log(JSON.stringify({ ...event, session_id }));
const toolUse = (name, input) => emit({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_' + name, name, input }] },
  parent_tool_use_id: null,
});
const say = (text, is_error = false) => {
  if (!stream) return console.log(text);
  const content = [{ type: 'text', text }];
  emit({ type: 'assistant', message: { role: 'assistant', content }, parent_tool_use_id: null });
  emit({ type: 'result', subtype: 'success', is_error, result: text });
};
let prompt = '';
process.stdin.on('data', (chunk) => { prompt += chunk; });
process.stdin.on('end', () => {
  if (stream) {
    emit({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Read', 'Bash'] });
    toolUse('Read', { file_path: join(process.cwd(), 'src', 'app.ts') });
    emit({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_Read', content: 'SECRET_FILE_CONTENTS' }] },
      parent_tool_use_id: null,
      tool_use_result: { type: 'text', file: { filePath: 'src/app.ts', content: 'SECRET_FILE_CONTENTS' } },
    });
  }
  // Background work makes a second turn, so the run prints a result for each.
  if (prompt.includes('TWO RESULTS')) {
    say('I started the sub agent.');
    say('It found the report: TICKET MOB-9.');
    process.exit(0);
  }
  // Calls the permission prompt tool from --mcp-config the way Claude Code 2.1.296 does, then
  // says what it got back.
  if (prompt.includes('PROMPT TOOL ')) {
    const argOf = (name) => process.argv[process.argv.indexOf(name) + 1];
    const [name, server] = Object.entries(JSON.parse(argOf('--mcp-config')).mcpServers)[0];
    const tool = argOf('--permission-prompt-tool').slice(('mcp__' + name + '__').length);
    const call = JSON.parse(/PROMPT TOOL (.*)/.exec(prompt)[1]);
    const child = require('node:child_process').spawn(server.command, server.args, {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const send = (message) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\\n');
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\\n');
      buffer = lines.pop();
      for (const message of lines.map((line) => JSON.parse(line))) {
        if (message.id === 0) {
          send({ method: 'notifications/initialized' });
          const params = { name: tool, arguments: call, _meta: { progressToken: 1 } };
          send({ id: 1, method: 'tools/call', params });
          // Gives up on the call the way Claude Code cancels one, then waits for the test.
          if (prompt.includes('GIVE UP')) {
            setTimeout(() => send({ method: 'notifications/cancelled', params: { requestId: 1 } }), 300);
            const go = join(dirname(process.argv[1]), 'gave-up');
            setInterval(() => existsSync(go) && (say('GAVE UP'), process.exit(0)), 20);
          }
        }
        if (message.id === 1) {
          say('DECISION ' + message.result.content[0].text);
          child.kill();
          process.exit(0);
        }
      }
    });
    const clientInfo = { name: 'fake-claude', version: '9.9.9' };
    send({ id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo } });
    return;
  }
  if (prompt.includes('ASK FAIL')) { say('Credit balance is too low', true); process.exit(1); }
  // Waits for the test's go file, so a test can look at the steps while Claude still works.
  if (prompt.includes('SLOW STEPS')) {
    const go = join(dirname(process.argv[1]), 'go');
    const timer = setInterval(() => {
      if (!existsSync(go)) return;
      clearInterval(timer);
      toolUse('Bash', { command: 'npm test' });
      say('Done slowly.');
      process.exit(0);
    }, 20);
    return;
  }
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
    say('Did the work.\\n\\n\u0060\u0060\u0060\\nTICKET: ' + /\\b[A-Z]+-\\d+/.exec(prompt)[0]
      + '\\nSTATUS: done\\nSUMMARY: Fixed it.\\nFILES: a.ts\\nNEXT: none\\n\u0060\u0060\u0060');
    process.exit(0);
  }
  if (prompt.includes('FAIL')) { console.error('boom'); process.exit(3); }
  if (prompt.includes('WAIT')) { setTimeout(() => process.exit(0), 60000); return; }
  say('ARGS ' + JSON.stringify(process.argv.slice(2)) + '\\nCWD ' + process.cwd() + '\\nPROMPT ' + prompt);
  process.exit(0);
});
`;

export function installFakeClaude(): { command: string; dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const command = join(dir, 'claude');
  writeFileSync(command, SCRIPT);
  chmodSync(command, 0o755);
  return { command, dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
