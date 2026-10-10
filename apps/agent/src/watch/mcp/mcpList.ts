export interface McpServer {
  name: string;
  detail: string;
  state: string;
  ok: boolean;
}

// `claude mcp list` prints one line per server: "<name>: <command or url> - <state>".
const MARK = ' - ';
const CONNECTED = /^[✔✓]\s*Connected$/u;

function serverFrom(line: string): McpServer | undefined {
  const colon = line.indexOf(': ');
  const mark = line.lastIndexOf(MARK);
  if (colon === -1 || mark <= colon) return undefined;
  const state = line.slice(mark + MARK.length).trim();
  return {
    name: line.slice(0, colon).trim(),
    detail: line.slice(colon + 2, mark).trim(),
    state,
    ok: CONNECTED.test(state),
  };
}

export function parseMcpList(text: string): McpServer[] {
  const servers: McpServer[] = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const server = serverFrom(line);
    if (server) servers.push(server);
  }
  return servers;
}
