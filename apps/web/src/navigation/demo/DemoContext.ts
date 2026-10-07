import { createContext, use } from 'react';
import type { DemoProject } from './demoData';

export type DemoSheet = 'project' | 'ticket' | 'prompt' | 'report';

export interface DemoActions {
  projects: DemoProject[];
  advance: (key: string, num: number) => void;
  remove: (key: string, num: number) => void;
  refresh: () => Promise<void>;
  openSheet: (sheet: DemoSheet) => void;
  openOptions: (key: string) => void;
  openImages: (index: number) => void;
  exit: () => void;
  notify: (message: string) => void;
}

export const DemoContext = createContext<DemoActions | null>(null);

export function useDemo(): DemoActions {
  const demo = use(DemoContext);
  if (!demo) throw new Error('useDemo() needs the gestures demo provider.');
  return demo;
}
