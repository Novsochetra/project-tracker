import { TrackerClient } from '@tracker/client';
import { toYmd, type Priority } from '@tracker/shared';

interface SeedTicket {
  title: string;
  description?: string;
  status: string;
  priority: Priority;
  assignee?: string;
  dueInDays?: number;
  comments?: string[];
}

interface SeedProject {
  name: string;
  key: string;
  description: string;
  repo: string;
  tickets: SeedTicket[];
}

const dayOffset = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toYmd(date);
};

const PROJECTS: SeedProject[] = [
  {
    name: 'Mobile app',
    key: 'MOB',
    description: 'iOS and Android app for the next release.',
    repo: '~/code/mobile-app',
    tickets: [
      {
        title: 'Set up push notifications',
        description:
          'Configure FCM and APNs. Ask for permission after onboarding, not on first launch.',
        status: 'Done',
        priority: 'high',
        assignee: 'Dara',
        dueInDays: -3,
      },
      {
        title: 'Show an error when the password is wrong',
        description: 'Inline error under the password field. Keep the email filled in.',
        status: 'In progress',
        priority: 'high',
        assignee: 'Sophea',
        dueInDays: 2,
        comments: ['Design is approved. Starting on this today.'],
      },
      {
        title: 'Crash when rotating the profile screen',
        description: 'Steps: open Profile, rotate the device twice.',
        status: 'To do',
        priority: 'high',
        assignee: 'Dara',
        dueInDays: 1,
      },
      { title: 'Dark mode colors for Settings', status: 'To do', priority: 'medium', dueInDays: 7 },
      { title: 'Update App Store screenshots', status: 'To do', priority: 'low' },
      {
        title: 'Cache avatars on disk',
        description: 'Avatars reload on every launch. Cache them for a week.',
        status: 'Need review',
        priority: 'medium',
        assignee: 'Claude',
      },
    ],
  },
  {
    name: 'Website',
    key: 'WEB',
    description: 'Marketing site and pricing page.',
    repo: '~/code/website',
    tickets: [
      {
        title: 'Pricing page layout',
        description: 'Three plans side by side on desktop, stacked on phones.',
        status: 'In progress',
        priority: 'medium',
        assignee: 'Vanna',
        dueInDays: 4,
      },
      { title: 'Compress hero images', status: 'Done', priority: 'low', assignee: 'Vanna' },
      {
        title: 'Spam protection on the contact form',
        status: 'To do',
        priority: 'medium',
        dueInDays: 10,
      },
    ],
  },
];

async function seedProject(client: TrackerClient, seed: SeedProject): Promise<void> {
  const { project, statuses } = await client.createProject({
    name: seed.name,
    key: seed.key,
    description: seed.description,
    repo: seed.repo,
  });
  const statusId = (name: string): string | undefined => statuses.find((s) => s.name === name)?.id;
  for (const ticket of [...seed.tickets].reverse()) {
    const created = await client.createTicket(project.key, {
      title: ticket.title,
      description: ticket.description ?? '',
      statusId: statusId(ticket.status),
      priority: ticket.priority,
      assignee: ticket.assignee ?? '',
      due: ticket.dueInDays === undefined ? '' : dayOffset(ticket.dueInDays),
    });
    for (const text of ticket.comments ?? []) await client.addComment(created.key, { text });
  }
}

async function main(): Promise<void> {
  const url = process.argv[2] ?? process.env.TRACKER_URL ?? 'http://localhost:4100';
  const client = new TrackerClient({ baseUrl: url, token: process.env.TRACKER_TOKEN });
  const existing = new Set((await client.listProjects()).map((p) => p.key));
  for (const seed of PROJECTS) {
    if (existing.has(seed.key)) continue;
    await seedProject(client, seed);
    process.stdout.write(`Seeded ${seed.key} · ${seed.name}\n`);
  }
}

await main();
