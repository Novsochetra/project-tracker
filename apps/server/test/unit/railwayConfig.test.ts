import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Options } from 'tsup';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config';
import { HEALTH_PATH } from '../../src/http/auth';
import { SHUTDOWN_GRACE_MS } from '../../src/shutdown';
import tsupConfig from '../../tsup.config';

interface RailwayConfig {
  build: { builder: string; buildCommand: string };
  deploy: {
    startCommand: string;
    preDeployCommand: string[];
    healthcheckPath: string;
    drainingSeconds: number;
  };
}

const railway = JSON.parse(readFileSync(join(REPO_ROOT, 'railway.json'), 'utf8')) as RailwayConfig;

const builtEntries = Object.keys((tsupConfig as Options).entry as Record<string, string>);

const serverFileOf = (command: string | undefined) =>
  /^node apps\/server\/dist\/([\w-]+)\.js\b/.exec(command ?? '')?.[1];

// railway.json is only read by Railway, so a renamed entry or route would first fail a deploy.
describe('railway.json', () => {
  it('starts and migrates with files the server build makes', () => {
    expect(railway.build.buildCommand).toMatch(/^npm run build && /);
    expect(builtEntries).toContain(serverFileOf(railway.deploy.startCommand));
    expect(railway.deploy.preDeployCommand).toEqual(['node apps/server/dist/db.js migrate']);
    expect(builtEntries).toContain(serverFileOf(railway.deploy.preDeployCommand[0]));
  });

  it('checks the health route, which needs no sign-in', () => {
    expect(railway.deploy.healthcheckPath).toBe(HEALTH_PATH);
  });

  it('lets a stopping server use its whole grace before it is killed', () => {
    expect(railway.deploy.drainingSeconds * 1000).toBeGreaterThan(SHUTDOWN_GRACE_MS);
  });
});
