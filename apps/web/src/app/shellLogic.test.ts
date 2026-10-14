import { describe, expect, it } from 'vitest';
import { breadcrumbFor, projectKeyOf } from './crumbs';
import { gateFor, linkPageOf } from './sessionGate';

describe('gateFor', () => {
  it('waits for the first session answer', () => {
    expect(gateFor({ data: undefined, fetchStatus: 'fetching' })).toBe('loading');
  });

  it('asks to sign in only when the server needs it and the app is signed out', () => {
    const data = { authRequired: true, authenticated: false };
    expect(gateFor({ data, fetchStatus: 'idle' })).toBe('login');
    expect(gateFor({ data: { ...data, authenticated: true }, fetchStatus: 'idle' })).toBe('app');
    expect(
      gateFor({ data: { authRequired: false, authenticated: true }, fetchStatus: 'idle' }),
    ).toBe('app');
  });

  it('shows the invite page whether signed in or not, once the session is known', () => {
    const signedOut = { authRequired: true, authenticated: false };
    expect(gateFor({ data: signedOut, fetchStatus: 'idle' }, 'invite')).toBe('invite');
    expect(
      gateFor({ data: { ...signedOut, authenticated: true }, fetchStatus: 'idle' }, 'invite'),
    ).toBe('invite');
    expect(gateFor({ data: undefined, fetchStatus: 'fetching' }, 'invite')).toBe('loading');
  });

  it('shows the reset page signed in or not, and knows each link page by its address', () => {
    const signedOut = { authRequired: true, authenticated: false };
    expect(gateFor({ data: signedOut, fetchStatus: 'idle' }, 'reset')).toBe('reset');
    expect(linkPageOf('/reset-password')).toBe('reset');
    expect(linkPageOf('/invite')).toBe('invite');
    expect(linkPageOf('/p/MOB')).toBeUndefined();
  });

  it('opens the app when the session request is paused or failed offline', () => {
    expect(gateFor({ data: undefined, fetchStatus: 'paused' })).toBe('app');
    expect(gateFor({ data: undefined, fetchStatus: 'idle' })).toBe('app');
  });
});

describe('breadcrumbFor', () => {
  const project = { name: 'Mobile app', key: 'MOB', color: '#5B5BD6' };

  it('is a single current crumb on Projects', () => {
    expect(breadcrumbFor({ name: 'projects' }, undefined)).toEqual([
      { level: 'projects', label: 'Projects', target: null },
    ]);
  });

  it('links back to Projects from a project', () => {
    expect(breadcrumbFor({ name: 'project', key: 'MOB' }, project)).toEqual([
      { level: 'projects', label: 'Projects', target: { name: 'projects' } },
      { level: 'project', label: 'Mobile app', color: '#5B5BD6', target: null },
    ]);
  });

  it('names a project that hides its name by its key', () => {
    const hidden = { ...project, hideName: true };
    expect(breadcrumbFor({ name: 'ticket', key: 'MOB', num: 3 }, hidden)[1]?.label).toBe(
      'Project MOB',
    );
  });

  it('links to the project and ends with the ticket key on a ticket', () => {
    expect(breadcrumbFor({ name: 'ticket', key: 'mob', num: 3 }, project)).toEqual([
      { level: 'projects', label: 'Projects', target: { name: 'projects' } },
      {
        level: 'project',
        label: 'Mobile app',
        color: '#5B5BD6',
        target: { name: 'project', key: 'MOB' },
      },
      { level: 'ticket', label: 'MOB-3', target: null },
    ]);
  });

  it('goes through Ask Claude to a chat, named by its title once loaded', () => {
    const chat = { name: 'chat', key: 'mob', chatId: 'c-1' } as const;
    expect(breadcrumbFor(chat, project, 'How does sync work?').slice(2)).toEqual([
      { level: 'chats', label: 'Ask Claude', target: { name: 'chats', key: 'MOB' } },
      { level: 'chat', label: 'How does sync work?', target: null },
    ]);
    expect(breadcrumbFor({ name: 'chats', key: 'MOB' }, project).slice(1)).toEqual([
      {
        level: 'project',
        label: 'Mobile app',
        color: '#5B5BD6',
        target: { name: 'project', key: 'MOB' },
      },
      { level: 'chats', label: 'Ask Claude', target: null },
    ]);
    const fresh = breadcrumbFor({ name: 'chat', key: 'MOB', chatId: null }, project);
    expect(fresh.at(-1)?.label).toBe('New chat');
  });

  it('goes through the ticket to a chat opened from it', () => {
    const chat = { name: 'chat', key: 'MOB', chatId: null, ticketNum: 3 } as const;
    expect(breadcrumbFor(chat, project).slice(2)).toEqual([
      { level: 'ticket', label: 'MOB-3', target: { name: 'ticket', key: 'MOB', num: 3 } },
      { level: 'chat', label: 'New chat', target: null },
    ]);
  });

  it('shows the key while the project is still loading', () => {
    const crumbs = breadcrumbFor({ name: 'ticket', key: 'web', num: 1 }, undefined);
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Projects', 'WEB', 'WEB-1']);
  });
});

describe('projectKeyOf', () => {
  it('reads the project of project and ticket routes', () => {
    expect(projectKeyOf({ name: 'projects' })).toBeNull();
    expect(projectKeyOf({ name: 'project', key: 'MOB' })).toBe('MOB');
    expect(projectKeyOf({ name: 'ticket', key: 'MOB', num: 2 })).toBe('MOB');
  });
});
