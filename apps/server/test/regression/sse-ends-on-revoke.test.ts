import { describe, expect, it } from 'vitest';
import { addOwner, JSON_HEADERS, signIn } from '../helpers/auth';
import { useTestServer } from '../helpers/server';

type Reader = ReadableStreamDefaultReader<Uint8Array>;

// Reviewer 100: what an open stream still delivers within `ms` after its access ended. A read
// still waiting when time runs out is kept for the next call, so no chunk is lost.
const pending = new WeakMap<Reader, ReturnType<Reader['read']>>();
async function readFor(reader: Reader, ms: number): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  const stop = new Promise<'stop'>((resolve) => setTimeout(() => resolve('stop'), ms));
  for (;;) {
    const next = pending.get(reader) ?? reader.read();
    pending.set(reader, next);
    const chunk = await Promise.race([next, stop]);
    if (chunk === 'stop') return text;
    pending.delete(reader);
    if (chunk.done) return text;
    text += decoder.decode(chunk.value, { stream: true });
  }
}

describe('live stream after access ends', () => {
  const api = useTestServer('sqlite', { heartbeatMs: 50 });

  async function openStream(headers: Record<string, string>): Promise<Reader> {
    const res = await api.app.request('/api/events', { headers });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    await readFor(reader, 20);
    return reader;
  }

  it('stops sending changes to a revoked API token', async () => {
    await addOwner(api.db);
    const cookie = await signIn(api.app);
    const created = await api.app.request('/api/tokens', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: 'agent' }),
    });
    const { token, secret } = (await created.json()) as { token: { id: string }; secret: string };
    const reader = await openStream({ authorization: `Bearer ${secret}` });

    const revoked = await api.app.request(`/api/tokens/${token.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(revoked.status).toBe(204);
    await api.app.request('/api/projects', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: 'After revoke' }),
    });

    expect(await readFor(reader, 300)).not.toMatch(/^data: {"type":"changed"/m);
    await reader.cancel();
  });

  it('stops sending changes to a session ended by sign out everywhere', async () => {
    await addOwner(api.db);
    const phone = await signIn(api.app);
    const reader = await openStream({ cookie: phone });

    const laptop = await signIn(api.app);
    expect(
      (await api.app.request('/api/sessions', { method: 'DELETE', headers: { cookie: laptop } }))
        .status,
    ).toBe(200);
    const again = await signIn(api.app);
    await api.app.request('/api/projects', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie: again },
      body: JSON.stringify({ name: 'After sign out everywhere' }),
    });

    expect(await readFor(reader, 300)).not.toMatch(/^data: {"type":"changed"/m);
    await reader.cancel();
  });
});
