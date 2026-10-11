import { describe, expect, it } from 'vitest';
import { MASK } from '../../src/logic/runSteps/secretRules';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// After a PRIVATE KEY marker every later base64-looking line became ***, a path that runs
// included, so the person allowed a command they couldn't see (PT-171 third review). A key body is
// masked only when a Write's or an edit's whole text is one key block, which never runs.
const labelOf = (name: string, input: Record<string, unknown>) =>
  permissionLabel(name, input, '/r').label;

describe('a private key marker', () => {
  it('hides no line of a command', () => {
    const command =
      "echo '-----BEGIN RSA PRIVATE KEY-----' > /dev/null\n/tmp/payloads/installer\nrm -rf ~";
    expect(labelOf('Bash', { command })).toBe(`Run ${command}`);
    const other = 'x=-----BEGIN PRIVATE KEY-----\nshutdownNowPleaseX';
    expect(labelOf('Bash', { command: other })).toBe(`Run ${other}`);
  });

  it('hides no line of a script that holds it', () => {
    const content = '#!/bin/sh\n# -----BEGIN PRIVATE KEY-----\n/opt/attacker/bin/run';
    expect(labelOf('Write', { file_path: '/r/a.sh', content })).toContain(
      '+ /opt/attacker/bin/run',
    );
    const new_string =
      '-----BEGIN PRIVATE KEY-----\n/usr/local/bin/evilcmd\n-----END PRIVATE KEY-----\nrun';
    expect(labelOf('Edit', { file_path: '/r/a.sh', old_string: 'x', new_string })).toContain(
      '+ /usr/local/bin/evilcmd',
    );
  });

  it('masks the body of a file that is only a key', () => {
    const body = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW';
    const content = `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n${body}\n-----END OPENSSH PRIVATE KEY-----\n`;
    expect(labelOf('Write', { file_path: '/r/id', content }).split('\n')).toEqual([
      'Write id',
      '+ -----BEGIN OPENSSH PRIVATE KEY-----',
      `+ ${MASK}`,
      `+ ${MASK}`,
      '+ -----END OPENSSH PRIVATE KEY-----',
      '+ ',
    ]);
  });
});
