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
});
