import { describe, expect, it } from 'vitest';
import { breadcrumbFor, projectKeyOf } from './crumbs';
import { gateFor } from './sessionGate';

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
