import { describe, expect, it } from 'vitest';
import { permissionPush } from '../../src/logic/pushMessages';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// A push shows on the lock screen without unlocking, and its title held the command, which
// masking leaves whole when a password isn't one literal word after a secret's name (PT-210 review).
const TICKET = { ticket: { projectKey: 'MOB', num: 12, title: 'Deploy' } };

const pushFor = (command: string) =>
  permissionPush(TICKET, permissionLabel('Bash', { command }, '/repo').label);

describe('a permission push on the lock screen', () => {
  it.each([
    ['mysql -u root -phunter2pass mydb', 'hunter2pass', 'MOB-12: Claude wants to run mysql'],
    ['sshpass -p hunter2 ssh me@host', 'hunter2', 'MOB-12: Claude wants to run sshpass'],
    [
      'docker login -p "my pass word" registry',
      'pass word',
      'MOB-12: Claude wants to run docker login',
    ],
    ['echo hunter2 | sudo -S apt install x', 'hunter2', 'MOB-12: Claude wants to run echo'],
  ])('shows no secret of %s', (command, secret, title) => {
    const push = pushFor(command);
    expect(push.title).toBe(title);
    expect(JSON.stringify(push)).not.toContain(secret);
  });
});
