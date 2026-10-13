import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackerApi } from '../src/client';
import { createMcpServer } from '../src/server';
import { fakeClient, imageResponse, rejectWith, returns } from './fakeClient';
import { attachment, detail, projectSummary, statuses, ticket } from './fixtures';

const TOOL_NAMES = [
  'list_projects',
  'list_statuses',
  'list_tickets',
  'get_ticket',
  'create_ticket',
  'update_ticket',
  'move_ticket',
  'add_comment',
  'attach_file',
  'claim_next_ticket',
  'claim_ticket',
  'submit_for_review',
  'review_ticket',
];

let client: Client | undefined;

async function connect(tracker: TrackerApi): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([
    createMcpServer(tracker).connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe('MCP server', () => {
  it('introduces itself as "tracker" with workflow instructions', async () => {
    const mcp = await connect(fakeClient({}));
    expect(mcp.getServerVersion()?.name).toBe('tracker');
    expect(mcp.getInstructions()).toContain('Agents never move tickets to Done');
  });

  it('lists every tool with a description and an input schema', async () => {
    const { tools } = await (await connect(fakeClient({}))).listTools();
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    for (const tool of tools) expect(tool.description?.length).toBeGreaterThan(80);
    const move = tools.find((tool) => tool.name === 'move_ticket');
    expect(move?.inputSchema.required).toEqual(['ticket', 'status']);
    expect(move?.annotations?.readOnlyHint).toBe(false);
    const get = tools.find((tool) => tool.name === 'get_ticket');
    expect(get?.annotations?.readOnlyHint).toBe(true);
  });

  it('publishes key patterns that also accept lowercase keys', async () => {
    const { tools } = await (await connect(fakeClient({}))).listTools();
    const get = tools.find((tool) => tool.name === 'get_ticket');
    const ticket = get?.inputSchema.properties?.ticket as { pattern: string };
    expect(new RegExp(ticket.pattern).test('mob-3')).toBe(true);
  });

  it('calls a tool and returns its text', async () => {
    const listTickets = vi.fn(returns([ticket()]));
    const tracker = fakeClient({
      getProject: returns({ project: projectSummary(), statuses: statuses() }),
      listTickets,
    });
    const result = await (
      await connect(tracker)
    ).callTool({
      name: 'list_tickets',
      arguments: { project: 'mob', category: 'todo' },
    });
    expect(listTickets).toHaveBeenCalledWith('MOB', {
      status: undefined,
      category: 'todo',
      q: undefined,
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'MOB-3 · To do · High · Crash when rotating the profile screen' },
    ]);
  });

  it('returns ticket images as image content', async () => {
    const tracker = fakeClient({
      getTicket: returns(detail({ attachments: [attachment()] })),
      fetchAttachment: returns(imageResponse(4)),
    });
    const result = await (
      await connect(tracker)
    ).callTool({
      name: 'get_ticket',
      arguments: { ticket: 'MOB-3' },
    });
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text' }),
      { type: 'text', text: 'Image screenshot.png:' },
      { type: 'image', data: Buffer.from([7, 7, 7, 7]).toString('base64'), mimeType: 'image/png' },
    ]);
  });

  it('returns text files inside the ticket text, before the images', async () => {
    const log = attachment({ id: 'log', fileName: 'crash.log', mimeType: 'text/plain' });
    const tracker = fakeClient({
      getTicket: returns(detail({ attachments: [log, attachment()] })),
      fetchAttachmentText: returns('ERROR db down'),
      fetchAttachment: returns(imageResponse(4)),
    });
    const result = await (
      await connect(tracker)
    ).callTool({
      name: 'get_ticket',
      arguments: { ticket: 'MOB-3' },
    });
    const [text, ...rest] = result.content as { type: string; text?: string }[];
    expect(text?.text).toContain('Contents of crash.log:\n```\nERROR db down\n```');
    expect(rest.map((block) => block.type)).toEqual(['text', 'image']);
  });

  it('tells agents what get_ticket shows of each kind of attachment', async () => {
    const { tools } = await (await connect(fakeClient({}))).listTools();
    const description = tools.find((tool) => tool.name === 'get_ticket')?.description ?? '';
    for (const words of ['returned as images', 'Text files', '20,000', 'Videos and PDFs']) {
      expect(description).toContain(words);
    }
    expect(description).toContain('API token');
  });

  it('returns API errors as error results', async () => {
    const tracker = fakeClient({
      getTicket: rejectWith(404, 'not_found', 'Ticket MOB-99 not found.'),
    });
    const result = await (
      await connect(tracker)
    ).callTool({
      name: 'get_ticket',
      arguments: { ticket: 'MOB-99' },
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Ticket MOB-99 not found.' }],
      isError: true,
    });
  });

  it('returns invalid arguments as error results', async () => {
    const result = await (
      await connect(fakeClient({}))
    ).callTool({
      name: 'review_ticket',
      arguments: { ticket: 'MOB-3', verdict: 'approved', rating: 9, summary: 'ok' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Rating must be a whole number from 1 to 5.');
  });

  it('lists the work and review prompts with an optional project argument', async () => {
    const { prompts } = await (await connect(fakeClient({}))).listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(['work', 'review']);
    for (const prompt of prompts) {
      expect(prompt.arguments).toEqual([
        { name: 'project', description: 'Project key, e.g. MOB.', required: false },
      ]);
    }
  });

  it('builds the work prompt for a project', async () => {
    const result = await (
      await connect(fakeClient({}))
    ).getPrompt({
      name: 'work',
      arguments: { project: 'mob' },
    });
    const [message] = result.messages;
    expect(message?.role).toBe('user');
    expect(message?.content).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Call claim_next_ticket with project "MOB"'),
    });
  });

  it('builds the review prompt', async () => {
    const result = await (
      await connect(fakeClient({}))
    ).getPrompt({
      name: 'review',
      arguments: { project: 'MOB' },
    });
    expect(result.messages[0]?.content).toMatchObject({
      text: expect.stringContaining('category "in_review"'),
    });
  });
});
