import { test as base, expect, type Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { PHONE_QUERY } from '../src/lib/media';
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

// The app's own phone query, for a test that depends on the layout rather than the project: a
// phone turned sideways (844×390) gets the phone layout too (PT-84).
export const usesPhoneLayout = (page: Page): Promise<boolean> =>
  page.evaluate((query) => window.matchMedia(query).matches, PHONE_QUERY);

export const isTablet = (projectName: string): boolean => projectName === 'tablet';
