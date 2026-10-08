import { describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const ids = Array.from({ length: 21 }, (_, index) => `upload-${index + 1}`);

// zod's own words reached the person: "Too big: expected array to have <=20 items".
describe('more than 20 files', () => {
  const api = useTestServer('sqlite');

  it('says in plain words how many files a new ticket can have', async () => {
    await api.post('/api/projects', { name: 'Mobile app' });
    const answer = await api.post('/api/projects/MA/tickets', {
      title: 'Crash',
      attachmentIds: ids,
    });
    expect(answer).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid_input', message: 'A new ticket can have up to 20 files.' } },
    });
  });

  it('says in plain words how many files a comment can have', async () => {
    await api.post('/api/projects', { name: 'Mobile app' });
    await api.post('/api/projects/MA/tickets', { title: 'Crash' });
    const answer = await api.post('/api/tickets/MA-1/comments', {
      text: 'Logs',
      attachmentIds: ids,
    });
    expect(answer).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid_input', message: 'A comment can have up to 20 files.' } },
    });
  });

  it('asks for text or a file, not only an image, when a comment has neither', async () => {
    await api.post('/api/projects', { name: 'Mobile app' });
    await api.post('/api/projects/MA/tickets', { title: 'Crash' });
    const answer = await api.post('/api/tickets/MA-1/comments', { text: ' ' });
    expect(answer.body).toEqual({
      error: { code: 'invalid_input', message: 'Write a comment or add a file.' },
    });
  });
});
