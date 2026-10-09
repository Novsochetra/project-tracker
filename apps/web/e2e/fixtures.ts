import { test as base, expect } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { API_URL } from './ports';

interface Fixtures {
  api: TrackerClient;
  agent: TrackerClient;
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    const reset = await request.post(`${API_URL}/api/test/reset`);
    expect(reset.status()).toBe(204);
    await use(new TrackerClient({ baseUrl: API_URL }));
  },
  agent: async ({ api }, use) => {
    void api;
    await use(new TrackerClient({ baseUrl: API_URL, actor: { kind: 'agent', name: 'Claude' } }));
  },
});

export { expect };

export const isPhone = (projectName: string): boolean => projectName === 'phone';

export const isTablet = (projectName: string): boolean => projectName === 'tablet';
