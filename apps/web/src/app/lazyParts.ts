import { lazyWithPreload } from '../lib/lazyWithPreload';
import { routeStack, type Route } from '../navigation';

export const ProjectScreen = lazyWithPreload(() =>
  import('../features/project/projectScreens').then((module) => module.ProjectScreen),
);
export const TicketScreen = lazyWithPreload(() =>
  import('../features/ticket/ticketParts').then((module) => module.TicketScreen),
);
export const ChatsScreen = lazyWithPreload(() =>
  import('../features/project/projectScreens').then((module) => module.ChatsScreen),
);
export const ChatScreen = lazyWithPreload(() =>
  import('../features/project/projectScreens').then((module) => module.ChatScreen),
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
export const RunStepsSheet = lazyWithPreload(() =>
  import('../features/ticket/ticketParts').then((module) => module.RunStepsSheet),
);
export const ConnectSheet = lazyWithPreload(() =>
  import('../features/connect/ConnectSheet').then((module) => module.ConnectSheet),
);
export const AccountSheet = lazyWithPreload(() =>
  import('../features/account/AccountSheet').then((module) => module.AccountSheet),
);
// Opened once per person, so it stays out of the first load.
export const InviteScreen = lazyWithPreload(() =>
  import('./InviteScreen').then((module) => module.InviteScreen),
);
export const ResetScreen = lazyWithPreload(() =>
  import('./ResetScreen').then((module) => module.ResetScreen),
);

interface Part {
  preload: () => Promise<unknown>;
  isLoaded: () => boolean;
}

const SCREENS: Record<Route['name'], Part | null> = {
  projects: null,
  project: ProjectScreen,
  ticket: TicketScreen,
  chats: ChatsScreen,
  chat: ChatScreen,
};
const SHEETS: Part[] = [
  NewTicketSheet,
  PromptSheet,
  ReportSheet,
  StatusManagerSheet,
  RunStepsSheet,
  ConnectSheet,
  AccountSheet,
];

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
  await Promise.all([ProjectScreen, TicketScreen, ChatsScreen, ChatScreen].map(preloadQuietly));
  await Promise.all(SHEETS.map(preloadQuietly));
}
