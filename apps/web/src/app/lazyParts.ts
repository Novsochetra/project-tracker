import { lazyWithPreload } from '../lib/lazyWithPreload';
import { routeStack, type Route } from '../navigation';

export const ProjectScreen = lazyWithPreload(() =>
  import('../features/project/ProjectScreen').then((module) => module.ProjectScreen),
);
export const TicketScreen = lazyWithPreload(() =>
  import('../features/ticket/TicketScreen').then((module) => module.TicketScreen),
);

export const NewTicketSheet = lazyWithPreload(() =>
  import('../features/project/NewTicketSheet').then((module) => module.NewTicketSheet),
);
export const PromptSheet = lazyWithPreload(() =>
  import('../features/claude/PromptSheet').then((module) => module.PromptSheet),
);
export const ReportSheet = lazyWithPreload(() =>
  import('../features/claude/ReportSheet').then((module) => module.ReportSheet),
);
export const StatusManagerSheet = lazyWithPreload(() =>
  import('../features/statuses/StatusManagerSheet').then((module) => module.StatusManagerSheet),
);
export const ConnectSheet = lazyWithPreload(() =>
  import('../features/connect/ConnectSheet').then((module) => module.ConnectSheet),
);

interface Part {
  preload: () => Promise<unknown>;
  isLoaded: () => boolean;
}

const SCREENS: Record<Route['name'], Part | null> = {
  projects: null,
  project: ProjectScreen,
  ticket: TicketScreen,
};
const SHEETS: Part[] = [NewTicketSheet, PromptSheet, ReportSheet, StatusManagerSheet, ConnectSheet];

// A part that fails to load fails again where it renders, which shows and reports it.
const preloadQuietly = (part: Part): Promise<unknown> => part.preload().catch(() => undefined);

// Every level, so a deep link loads its screens side by side instead of one after another.
export function preloadRoute(route: Route): void {
  for (const level of routeStack(route)) {
    const screen = SCREENS[level.name];
    if (screen) void preloadQuietly(screen);
  }
}

// What a push to the route waits for before it touches the history: the code of its screens still
// on their way, or null when they can show at once (PT-100).
export function screensOnTheirWay(route: Route): Promise<unknown> | null {
  const waiting = routeStack(route)
    .map((level) => SCREENS[level.name])
    .filter((screen): screen is Part => screen !== null && !screen.isLoaded());
  return waiting.length > 0 ? Promise.all(waiting.map(preloadQuietly)) : null;
}

// Screens first: on a slow network the screen a tap opens shouldn't share it with sheets.
export async function preloadParts(): Promise<void> {
  await Promise.all([ProjectScreen, TicketScreen].map(preloadQuietly));
  await Promise.all(SHEETS.map(preloadQuietly));
}
