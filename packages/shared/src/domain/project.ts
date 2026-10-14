export const PROJECT_COLORS = [
  '#5B5BD6',
  '#D97706',
  '#12A594',
  '#E5484D',
  '#8E4EC6',
  '#0091FF',
] as const;

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  repo: string;
  color: string;
  maxParallelRuns: number;
  nextNum: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary extends Project {
  totalCount: number;
  openCount: number;
  doneCount: number;
  lastActivityAt: number;
}
