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
// A chat's claude reads one JSON message a line and stays open; a crash ends it with a code.
const streamInput = process.argv.includes('--input-format');
// Claude Code 2.1.299 says when a turn is over only when asked to (chat/turnEvents.ts).
const state = (value) =>
  process.env.CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS === '1' &&
  emit({ type: 'system', subtype: 'session_state_changed', state: value });
function handle(prompt, exit) {
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
    exit(0);
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
            const timer = setInterval(() => existsSync(go) && (clearInterval(timer), say('GAVE UP'), exit(0)), 20);
          }
        }
        if (message.id === 1) {
          say('DECISION ' + message.result.content[0].text);
          child.kill();
          exit(0);
        }
      }
    });
    const clientInfo = { name: 'fake-claude', version: '9.9.9' };
    send({ id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo } });
    return;
  }
  // So a test can see the files are there while Claude runs.
  if (prompt.includes('SHOW FILES')) {
    const { readdirSync, readFileSync } = require('node:fs');
    const dir = process.argv[process.argv.indexOf('--add-dir') + 1];
    const { statSync } = require('node:fs');
    const { basename } = require('node:path');
    const paths = readdirSync(dir, { recursive: true }).map((name) => join(dir, name));
    const files = paths.filter((path) => statSync(path).isFile()).map((path) => basename(path) + '=' + readFileSync(path, 'utf8'));
    say('FILES ' + files.join(',') + '\\nARGS ' + JSON.stringify(process.argv.slice(2)) + '\\nPROMPT ' + prompt);
    exit(0);
  }
  if (prompt.includes('ASK FAIL')) { say('Credit balance is too low', true); exit(1); }
  // Waits for the test's go file, so a test can look at the steps while Claude still works.
  if (prompt.includes('SLOW STEPS')) {
    const go = join(dirname(process.argv[1]), 'go');
    const timer = setInterval(() => {
      if (!existsSync(go)) return;
      clearInterval(timer);
      toolUse('Bash', { command: 'npm test' });
      say('Done slowly.');
      exit(0);
    }, 20);
    return;
  }
  if (prompt.includes('SPLIT')) {
    const bytes = Buffer.from('café ✓');
    process.stderr.write(bytes.subarray(0, 4));
    setTimeout(() => { process.stderr.write(bytes.subarray(4)); exit(5); }, 100);
    return;
  }
  if (prompt.includes('TWO LINES')) {
    process.stderr.write('first line\\n');
    setTimeout(() => { process.stderr.write('second line\\n'); exit(4); }, 100);
    return;
  }
  if (prompt.includes('REPORT')) {
    say('Did the work.\\n\\n\u0060\u0060\u0060\\nTICKET: ' + /\\b[A-Z]+-\\d+/.exec(prompt)[0]
      + '\\nSTATUS: done\\nSUMMARY: Fixed it.\\nFILES: a.ts\\nNEXT: none\\n\u0060\u0060\u0060');
    exit(0);
  }
  if (prompt.includes('FAIL')) { console.error('boom'); exit(3); }
  if (prompt.includes('WAIT')) { setTimeout(() => exit(0), 60000); return; }
  say('ARGS ' + JSON.stringify(process.argv.slice(2)) + '\\nCWD ' + process.cwd() + '\\nPROMPT ' + prompt);
  exit(0);
}
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (!streamInput) return;
  const lines = input.split('\\n');
  input = lines.pop();
  for (const line of lines.filter(Boolean)) {
    const sent = JSON.parse(line);
    state('running');
    if (process.argv.includes('--replay-user-messages')) {
      emit({ type: 'user', isReplay: true, uuid: sent.uuid, message: sent.message });
    }
    handle(sent.message.content, (code) => (code === 0 ? state('idle') : process.exit(code)));
  }
});
process.stdin.on('end', () => (streamInput ? process.exit(0) : handle(input, process.exit)));
`;

export function installFakeClaude(): { command: string; dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const command = join(dir, 'claude');
  writeFileSync(command, SCRIPT);
  chmodSync(command, 0o755);
  return { command, dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
