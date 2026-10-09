import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { readActionSheet, readMenuConfirm, seedProject, toast } from './helpers';
import { REPO_ROOT, removeOwner, setOwner, signIn } from './owner';
import { API_URL } from './ports';

const CLI = join(REPO_ROOT, 'apps', 'agent', 'dist', 'cli.js');

// The built CLI, as an agent on the laptop runs it: only the saved config file, nothing from the
// shell running the tests.
function tracker(args: string[], configPath: string, input?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, TRACKER_CONFIG: configPath };
  for (const name of ['TRACKER_URL', 'TRACKER_API_TOKEN', 'TRACKER_TOKEN', 'XDG_CONFIG_HOME']) {
    delete env[name];
  }
  return spawnSync(process.execPath, [CLI, ...args], { env, input, encoding: 'utf8' });
}

test.describe('API tokens for agents', () => {
  let configDir: string;

  test.beforeAll(() => {
    execFileSync('npm', ['run', 'build', '-w', '@tracker/agent'], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  });

  test.beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), 'tracker-agent-config-'));
  });

  test.afterEach(async ({ request }) => {
    rmSync(configDir, { recursive: true, force: true });
    await removeOwner(request);
  });

  test('a token made in Connect lets the CLI in until it is revoked', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on launch' }]);
    setOwner();
    const config = join(configDir, 'config.json');

    await page.goto('/p/MOB');
    await signIn(page);
    await expect(page.getByText('Crash on launch')).toBeVisible();
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Connect Claude Code' }).click();
    const sheet = page.getByRole('dialog', { name: 'Connect Claude Code' });
    await expect(sheet.getByText(API_URL, { exact: true })).toBeVisible();
    await expect(sheet.getByText(`login --url ${API_URL}`)).toBeVisible();
    await expect(sheet.getByText('No tokens yet.')).toBeVisible();

    await sheet.getByRole('textbox', { name: 'Token name' }).fill('E2E laptop');
    await sheet.getByRole('button', { name: 'Create token' }).click();
    const card = sheet.getByRole('group', { name: 'New token E2E laptop' });
    await expect(card).toContainText('You won’t see this token again.');
    const secret = (await card.locator('code').textContent()) ?? '';
    expect(secret).toMatch(/^trk_\S{20,}$/);

    const login = tracker(['login', '--url', API_URL], config, `${secret}\n`);
    expect(login.stderr).toBe('');
    expect(login.status).toBe(0);
    expect(login.stdout).toContain(`Saved. The CLI and the MCP server now use ${API_URL}`);
    expect(login.stdout).not.toContain(secret);
    expect(statSync(config).mode & 0o777).toBe(0o600);

    const projects = tracker(['projects'], config);
    expect(projects.stderr).toBe('');
    expect(projects.stdout.trim()).toBe('MOB · Mobile app · 1 open, 1 total · repo ~/code/demo');

    await card.getByRole('button', { name: 'Done' }).click();
    await expect(sheet.getByText(secret)).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Revoke E2E laptop' }).click();
    await readMenuConfirm(page);
    await sheet.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(toast(page, 'Revoked “E2E laptop”')).toBeVisible();
    await expect(sheet.getByText('No tokens yet.')).toBeVisible();

    const refused = tracker(['projects'], config);
    expect(refused.status).toBe(1);
    expect(refused.stdout).toBe('');
    expect(refused.stderr.trim()).toBe(
      `Error: The tracker at ${API_URL} refused the token saved by tracker login: it was revoked, mistyped or made for another tracker. ` +
        `Create one in the app: Connect Claude Code → API tokens. Then run "tracker login --url ${API_URL}" and paste the new one.`,
    );
    expect(refused.stderr).not.toContain(secret);
  });
});
