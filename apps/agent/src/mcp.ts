import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTrackerClient } from './client';
import { loadConfig } from './config';
import { createMcpServer } from './server';

// stdout carries the MCP protocol, so every log line goes to stderr.
const config = loadConfig(process.env);
const server = createMcpServer(createTrackerClient(config));
await server.connect(new StdioServerTransport());
console.error(`tracker MCP server ready: ${config.url} as ${config.agentName}`);
