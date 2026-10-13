export const PROJECT_COLORS = [
  '#5B5BD6',
  '#D97706',
  '#12A594',
  '#E5484D',
  '#8E4EC6',
  '#0091FF',
] as const;

// A plain number as well as in the API's schemas, so the web app reads it without loading zod.
export const PROJECT_INSTRUCTIONS_MAX = 20_000;

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  repo: string;
  // Optional: trackers from before PT-200 don't send it, and agents can be newer than their tracker.
  instructions?: string;
  color: string;
  nextNum: number;
  createdAt: number;
  updatedAt: number;
  // Review Claude's work with Claude when a run ends in review (§1.11). Optional: trackers from
  // before PT-192 don't send it.
  autoReview?: boolean;
}

export interface ProjectSummary extends Project {
  totalCount: number;
  openCount: number;
  doneCount: number;
  // Optional: trackers from before PT-181 don't send it, and agents can be newer than their tracker.
  reviewedCount?: number;
  lastActivityAt: number;
}
