import { describe, expect, it } from 'vitest';
import type { Route } from './routes';
import {
  advanceStackModel,
  createStackModel,
  layerRole,
  settleStackModel,
  type StackModel,
} from './stackModel';

const projects: Route = { name: 'projects' };
const mob: Route = { name: 'project', key: 'MOB' };
const mob3: Route = { name: 'ticket', key: 'MOB', num: 3 };
const web5: Route = { name: 'ticket', key: 'WEB', num: 5 };

const paths = (model: StackModel) =>
  model.layers.map((layer) => `${layer.path}${layer.exiting ? ' (exiting)' : ''}`);

describe('createStackModel', () => {
  it('mounts every level of a deep link', () => {
    const model = createStackModel('a', mob3, false);
    expect(paths(model)).toEqual(['/', '/p/MOB', '/p/MOB/3']);
    expect(model.animation).toBe('none');
    expect(layerRole(model, null, '/p/MOB/3')).toBe('top');
    expect(layerRole(model, null, '/p/MOB')).toBe('hidden');
  });

  it('fades the first screen in when animating', () => {
    const model = createStackModel('a', mob, true);
    expect(model.animation).toBe('initial');
    expect(layerRole(model, null, '/p/MOB')).toBe('front');
    expect(layerRole(model, null, '/')).toBe('hidden');
  });
});

describe('advanceStackModel', () => {
  it('pushes a child over its parent', () => {
    const model = advanceStackModel(createStackModel('a', mob, false), 'b', mob3, 'push');
    expect(paths(model)).toEqual(['/', '/p/MOB', '/p/MOB/3']);
    expect(model).toMatchObject({ animation: 'push', front: '/p/MOB/3', back: '/p/MOB', id: 1 });
    expect(layerRole(model, null, '/')).toBe('hidden');
  });

  it('keeps the old screen under a push into another branch until it settles', () => {
    const model = advanceStackModel(createStackModel('a', mob3, false), 'b', web5, 'push');
    expect(paths(model)).toEqual(['/', '/p/WEB', '/p/MOB/3 (exiting)', '/p/WEB/5']);
    expect(model).toMatchObject({ front: '/p/WEB/5', back: '/p/MOB/3' });
    expect(paths(settleStackModel(model))).toEqual(['/', '/p/WEB', '/p/WEB/5']);
  });

  it('keeps the popped screen on top while it slides away', () => {
    const model = advanceStackModel(createStackModel('a', mob3, false), 'b', mob, 'pop');
    expect(paths(model)).toEqual(['/', '/p/MOB', '/p/MOB/3 (exiting)']);
    expect(model).toMatchObject({ animation: 'pop', front: '/p/MOB/3', back: '/p/MOB' });
    expect(layerRole(model, null, '/p/MOB/3')).toBe('front');
    expect(layerRole(model, null, '/p/MOB')).toBe('back');
  });

  it('drops the middle level when popping two levels', () => {
    const model = advanceStackModel(createStackModel('a', mob3, false), 'b', projects, 'pop');
    expect(paths(model)).toEqual(['/', '/p/MOB/3 (exiting)']);
  });

  it('swaps instantly without an animation', () => {
    for (const transition of ['none', 'replace'] as const) {
      const model = advanceStackModel(createStackModel('a', mob3, false), 'b', mob, transition);
      expect(paths(model)).toEqual(['/', '/p/MOB']);
      expect(model.animation).toBe('none');
      expect(layerRole(model, null, '/p/MOB')).toBe('top');
    }
  });

  it('keeps the layer objects of screens that stay mounted', () => {
    const start = createStackModel('a', mob, false);
    const pushed = advanceStackModel(start, 'b', mob3, 'push');
    expect(pushed.layers[0]).toBe(start.layers[0]);
    expect(pushed.layers[1]).toBe(start.layers[1]);
    const settledLayers = settleStackModel(pushed).layers;
    expect(settledLayers[1]).toBe(start.layers[1]);
    expect(settledLayers[2]).toBe(pushed.layers[2]);
  });

  it('settles to the plain stack', () => {
    const model = settleStackModel(
      advanceStackModel(createStackModel('a', mob3, false), 'b', mob, 'pop'),
    );
    expect(paths(model)).toEqual(['/', '/p/MOB']);
    expect(model).toMatchObject({ animation: 'none', front: null, back: null, id: 1 });
  });
});

describe('layerRole during a swipe', () => {
  it('reveals the parent under the top screen', () => {
    const model = createStackModel('a', mob3, false);
    const swipe = { front: '/p/MOB/3', back: '/p/MOB' };
    expect(layerRole(model, swipe, '/p/MOB/3')).toBe('front');
    expect(layerRole(model, swipe, '/p/MOB')).toBe('back');
    expect(layerRole(model, swipe, '/')).toBe('hidden');
  });
});
