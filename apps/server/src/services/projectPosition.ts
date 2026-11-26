import type { ProjectRow } from '../db/schema';

// A new project goes last; the projects nobody reordered all sit at 0 and keep creation order.
export const nextProjectPosition = (rows: readonly Pick<ProjectRow, 'position'>[]): number =>
  rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.position)) + 1;
