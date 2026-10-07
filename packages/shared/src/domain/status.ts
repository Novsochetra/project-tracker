export const STATUS_CATEGORIES = ['todo', 'in_progress', 'in_review', 'reviewed', 'done'] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'Needs review',
  reviewed: 'Reviewed',
  done: 'Done',
};

export const STATUS_COLORS = [
  '#8E8E99',
  '#C26A06',
  '#0B68CB',
  '#18794E',
  '#5B5BD6',
  '#6E56CF',
  '#C2298A',
  '#B42318',
  '#12A594',
] as const;

export interface Status {
  id: string;
  projectId: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
  createdAt: number;
}

export interface StatusTemplate {
  name: string;
  category: StatusCategory;
  color: string;
}

export const DEFAULT_STATUSES: readonly StatusTemplate[] = [
  { name: 'To do', category: 'todo', color: '#8E8E99' },
  { name: 'In progress', category: 'in_progress', color: '#C26A06' },
  { name: 'Need review', category: 'in_review', color: '#0B68CB' },
  { name: 'Reviewed', category: 'reviewed', color: '#18794E' },
  { name: 'Done', category: 'done', color: '#5B5BD6' },
];

export const isDoneCategory = (category: StatusCategory): boolean => category === 'done';
