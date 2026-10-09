import { lazyWithPreload } from '../../lib/lazyWithPreload';

const importViewers = () => import('./viewers');

// One part for the three, loaded when a tile is pressed rather than with the Ticket screen
// (PT-103). The text preview is in it for the first load's sake: like every other part it
// reaches the components, overlays and api barrels, while the image and video viewers alone
// reach less of the shared code, so Rolldown split that code into one more first-load file.
// They all wait on the one import, so they arrive, or fail, together.
let viewers: ReturnType<typeof importViewers> | null = null;
const loadViewers = () => (viewers ??= importViewers());

export const ImageViewer = lazyWithPreload(() =>
  loadViewers().then((module) => module.ImageViewer),
);
export const VideoViewer = lazyWithPreload(() =>
  loadViewers().then((module) => module.VideoViewer),
);
export const TextPreviewSheet = lazyWithPreload(() =>
  loadViewers().then((module) => module.TextPreviewSheet),
);

const PARTS = [ImageViewer, VideoViewer, TextPreviewSheet];

// A part that fails to load fails again where it renders, which says so.
export function preloadViewers(): void {
  for (const part of PARTS) void part.preload().catch(() => undefined);
}

// Once their code is in, or failed to load, rendering a viewer won't wait.
export const settleViewers = (): Promise<unknown> =>
  Promise.allSettled(PARTS.map((part) => part.preload()));

export const viewersLoaded = (): boolean => PARTS.every((part) => part.isLoaded());
