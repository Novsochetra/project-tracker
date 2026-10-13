import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const dockerfile = readFileSync(repo('docker/helper/Dockerfile'), 'utf8');

// The tracker deploys on Railway from this repo; a root Dockerfile or .dockerignore would change
// how the tracker itself is built.
describe('the always-on helper image', () => {
  it('stays out of the repo root', () => {
    expect(existsSync(repo('Dockerfile'))).toBe(false);
    expect(existsSync(repo('.dockerignore'))).toBe(false);
    expect(existsSync(repo('docker/helper/Dockerfile.dockerignore'))).toBe(true);
  });

  it('runs the built CLI and registers the built MCP server', () => {
    const entries = readFileSync(repo('apps/agent/tsup.config.ts'), 'utf8');
    expect(entries).toContain("'src/cli.ts'");
    expect(entries).toContain("'src/mcp.ts'");
    expect(dockerfile).toContain(
      'ln -s /opt/tracker/apps/agent/dist/cli.js /usr/local/bin/tracker',
    );
    expect(dockerfile).toContain(
      'claude mcp add tracker --scope user -- node /opt/tracker/apps/agent/dist/mcp.js',
    );
    expect(dockerfile).not.toMatch(/^VOLUME/m);
  });

  // Railway applies the root railway.json to every service from this repo unless one names
  // another file, which would build and run the tracker in the helper's service.
  it('has a Railway config of its own that builds this image and runs nothing of the tracker', () => {
    const config = JSON.parse(readFileSync(repo('docker/helper/railway.json'), 'utf8')) as {
      build: Record<string, unknown>;
      deploy: Record<string, unknown>;
    };
    expect(config.build).toEqual({
      builder: 'DOCKERFILE',
      dockerfilePath: 'docker/helper/Dockerfile',
    });
    expect(config.deploy).toEqual({ restartPolicyType: 'ALWAYS' });
    expect(existsSync(repo(String(config.build.dockerfilePath)))).toBe(true);
  });
});
