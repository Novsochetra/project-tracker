import type { ViewerImage } from '../../overlays/viewerTypes';

export type DemoStatus = 'todo' | 'doing' | 'done';

export interface DemoTicket {
  num: number;
  title: string;
  status: DemoStatus;
}

export interface DemoProject {
  key: string;
  name: string;
  description: string;
  tickets: DemoTicket[];
}

export const STATUS_LABEL: Record<DemoStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
};

export const NEXT_STATUS: Record<DemoStatus, DemoStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

const TITLES = [
  'Crash when rotating the profile screen',
  'Show an error when the password is wrong',
  'Dark splash screen flashes on launch',
  'Pull to refresh does nothing offline',
  'Add haptics to the swipe actions',
  'Keyboard covers the comment box',
  'Back swipe stutters on long lists',
  'Large title jumps when the list is short',
  'Share sheet loses the ticket link',
  'Images open sideways from the camera roll',
  'Settings toggle does not save',
  'Badge count stays after reading',
];

const tickets = (count: number, offset: number): DemoTicket[] =>
  Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    title: TITLES[(i + offset) % TITLES.length] ?? 'Ticket',
    status: (['doing', 'todo', 'todo', 'done'] as const)[i % 4] ?? 'todo',
  }));

export const INITIAL_PROJECTS: DemoProject[] = [
  {
    key: 'MOB',
    name: 'Mobile app',
    description: 'iOS and Android client',
    tickets: tickets(12, 0),
  },
  { key: 'WEB', name: 'Website', description: 'Marketing site and docs', tickets: tickets(6, 4) },
  {
    key: 'API',
    name: 'Platform API',
    description: 'Hono server and data access',
    tickets: tickets(9, 7),
  },
];

const svgImage = (width: number, height: number, hue: number, label: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 75% 62%)"/><stop offset="1" stop-color="hsl(${hue + 50} 70% 42%)"/>
</linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<g fill="none" stroke="hsl(0 0% 100% / .35)" stroke-width="${width / 200}">
${Array.from({ length: 9 }, (_, i) => `<circle cx="${width / 2}" cy="${height / 2}" r="${(i + 1) * width * 0.06}"/>`).join('')}
</g>
<text x="50%" y="50%" fill="white" font-family="system-ui" font-size="${width / 12}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const DEMO_IMAGES: ViewerImage[] = [
  {
    id: 'landscape',
    url: svgImage(1600, 1000, 220, '1600 × 1000'),
    width: 1600,
    height: 1000,
    alt: 'Landscape screenshot',
  },
  {
    id: 'portrait',
    url: svgImage(750, 1624, 280, '750 × 1624'),
    width: 750,
    height: 1624,
    alt: 'Phone screenshot',
  },
  { id: 'square', url: svgImage(1200, 1200, 20, '1200 × 1200'), alt: 'Square photo' },
  {
    id: 'wide',
    url: svgImage(2400, 900, 140, '2400 × 900'),
    width: 2400,
    height: 900,
    alt: 'Wide banner',
  },
  {
    id: 'tall',
    url: svgImage(900, 1600, 330, '900 × 1600'),
    width: 900,
    height: 1600,
    alt: 'Tall photo',
  },
];

export const DEMO_PROMPT = Array.from(
  { length: 28 },
  (_, i) =>
    `${i === 0 ? '## MOB-3: Crash when rotating the profile screen' : `- Step ${i}: check the rotation handler and the saved state ${i}`}`,
).join('\n');
