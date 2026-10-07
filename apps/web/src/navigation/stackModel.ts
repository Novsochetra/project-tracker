import { routePath, routeStack, type Route, type Transition } from './routes';
import type { LayerRole, StackAnimation } from './stackMotion';

export interface StackLayer {
  path: string;
  route: Route;
  exiting: boolean;
}

export interface StackModel {
  locationKey: string;
  route: Route;
  path: string;
  layers: StackLayer[];
  animation: StackAnimation;
  front: string | null;
  back: string | null;
  id: number;
}

export interface SwipePair {
  front: string;
  back: string;
}

// Reusing layer objects keeps each screen's memoized element, so hidden screens skip re-rendering.
function stackLayers(route: Route, previous: StackLayer[]): StackLayer[] {
  return routeStack(route).map((level) => {
    const path = routePath(level);
    const kept = previous.find((layer) => layer.path === path && !layer.exiting);
    return kept ?? { path, route: level, exiting: false };
  });
}

function settledModel(
  locationKey: string,
  route: Route,
  layers: StackLayer[],
  id: number,
): StackModel {
  return {
    locationKey,
    route,
    path: routePath(route),
    layers,
    animation: 'none',
    front: null,
    back: null,
    id,
  };
}

export function createStackModel(locationKey: string, route: Route, animate: boolean): StackModel {
  const model = settledModel(locationKey, route, stackLayers(route, []), 0);
  return animate ? { ...model, animation: 'initial', front: model.path } : model;
}

function exitingLayer(prev: StackModel): StackLayer {
  const current = prev.layers.find((layer) => layer.path === prev.path && !layer.exiting);
  return { path: prev.path, route: current?.route ?? prev.route, exiting: true };
}

export function advanceStackModel(
  prev: StackModel,
  locationKey: string,
  route: Route,
  transition: Transition,
): StackModel {
  const next = settledModel(locationKey, route, stackLayers(route, prev.layers), prev.id + 1);
  const keepsPrevTop = next.layers.some((layer) => layer.path === prev.path);
  if (transition === 'push') {
    const below = next.layers.slice(0, -1);
    const top = next.layers.slice(-1);
    const layers = keepsPrevTop ? next.layers : [...below, exitingLayer(prev), ...top];
    return { ...next, layers, animation: 'push', front: next.path, back: prev.path };
  }
  if (transition === 'pop' && !keepsPrevTop) {
    const layers = [...next.layers, exitingLayer(prev)];
    return { ...next, layers, animation: 'pop', front: prev.path, back: next.path };
  }
  return next;
}

export function settleStackModel(model: StackModel): StackModel {
  if (model.animation === 'none') return model;
  const layers = model.layers.filter((layer) => !layer.exiting);
  return settledModel(model.locationKey, model.route, layers, model.id);
}

export function layerRole(model: StackModel, swipe: SwipePair | null, path: string): LayerRole {
  const pair = swipe ?? (model.front === null ? null : { front: model.front, back: model.back });
  if (pair === null) return path === model.path ? 'top' : 'hidden';
  if (path === pair.front) return 'front';
  if (path === pair.back) return 'back';
  return 'hidden';
}
