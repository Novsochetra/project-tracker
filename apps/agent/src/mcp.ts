import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTrackerClient } from './client';
import { loadConfig, type Config } from './config';
import { configPath, fileStore } from './configFile';
import { describeError } from './errors';
import { createMcpServer } from './server';

// stdout carries the MCP protocol, so every log line goes to stderr.
function startConfig(): Config {
  try {
    return loadConfig(process.env, {}, fileStore(configPath(process.env)).read());
  } catch (error) {
    console.error(`tracker MCP server: ${describeError(error)}`);
    process.exit(1);
  }
}

const config = startConfig();
const server = createMcpServer(createTrackerClient(config));
await server.connect(new StdioServerTransport());
const token = config.tokenSource
  ? `with the API token from ${config.tokenSource}`
  : 'without an API token';
console.error(`tracker MCP server ready: ${config.url} as ${config.agentName}, ${token}`);
