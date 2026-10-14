import { createRailwayContext, project } from 'railway/iac';
import type { Options } from 'tsup';
import { describe, expect, it } from 'vitest';
import railwayConfig from '../../../../.railway/railway';
import { HEALTH_PATH } from '../../src/http/auth';
import { SHUTDOWN_GRACE_MS } from '../../src/shutdown';
import tsupConfig from '../../tsup.config';

interface TrackerService {
  name: string;
  build: { buildCommand: string };
  deploy: {
    startCommand: string;
    preDeployCommand: string[];
    healthcheckPath: string;
    drainingSeconds: number;
  };
}

const { resources = [] } = await railwayConfig(
  createRailwayContext({ environment: 'production' }),
  project,
);
const tracker = (resources as unknown as TrackerService[]).find(
  ({ name }) => name === 'project-tracker',
);

const builtEntries = Object.keys((tsupConfig as Options).entry as Record<string, string>);

const serverFileOf = (command: string | undefined) =>
  /^node apps\/server\/dist\/([\w-]+)\.js\b/.exec(command ?? '')?.[1];

// Only Railway reads .railway/railway.ts, so a renamed entry or route would first fail a deploy.
describe('.railway/railway.ts', () => {
  it('starts and migrates with files the server build makes', () => {
    expect(tracker?.build.buildCommand).toMatch(/^npm run build && /);
    expect(builtEntries).toContain(serverFileOf(tracker?.deploy.startCommand));
    expect(tracker?.deploy.preDeployCommand).toEqual(['node apps/server/dist/db.js migrate']);
    expect(builtEntries).toContain(serverFileOf(tracker?.deploy.preDeployCommand[0]));
  });

  it('checks the health route, which needs no sign-in', () => {
    expect(tracker?.deploy.healthcheckPath).toBe(HEALTH_PATH);
  });

  it('lets a stopping server use its whole grace before it is killed', () => {
    expect((tracker?.deploy.drainingSeconds ?? 0) * 1000).toBeGreaterThan(SHUTDOWN_GRACE_MS);
  });
});
